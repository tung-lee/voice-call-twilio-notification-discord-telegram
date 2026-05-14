import { env } from '../config/index.js';
import { logger } from '../utils/index.js';
import os from 'os';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sip = require('sip');

export interface SipRingResult {
  success: boolean;
  error?: string;
}

function getLocalIp(): string {
  const nets = os.networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function makeSdp(ip: string): string {
  const id = Date.now();
  return (
    [
      'v=0',
      `o=- ${id} ${id} IN IP4 ${ip}`,
      's=Alert',
      `c=IN IP4 ${ip}`,
      't=0 0',
      'm=audio 20000 RTP/AVP 0 8',
      'a=rtpmap:0 PCMU/8000',
      'a=rtpmap:8 PCMA/8000',
      'a=sendonly',
    ].join('\r\n') + '\r\n'
  );
}

let sipActive = false;

export async function ringViaSip(): Promise<SipRingResult> {
  if (sipActive) {
    return { success: false, error: 'SIP call already in progress' };
  }

  return new Promise((resolve) => {
    sipActive = true;

    const localIp = getLocalIp();
    const botUser = env.SIP_BOT_USER!;
    const botDomain = env.SIP_BOT_DOMAIN!;
    const targetUser = env.SIP_TARGET_USER!;
    const targetDomain = env.SIP_TARGET_DOMAIN!;
    const ringDuration = env.SIP_RING_DURATION_MS;

    const targetUri = `sip:${targetUser}@${targetDomain}`;
    const fromUri = `sip:${botUser}@${botDomain}`;
    const callId = `${crypto.randomUUID()}@${localIp}`;
    const fromTag = crypto.randomBytes(4).toString('hex');
    const port = 5060 + Math.floor(Math.random() * 4000);

    let cseq = 1;
    let done = false;
    let callAnswered = false;
    let ringTimer: NodeJS.Timeout | undefined;
    let toHeader: unknown = null;
    let fromHeader: unknown = null;

    const finish = (success: boolean, error?: string) => {
      if (done) return;
      done = true;
      clearTimeout(ringTimer);
      setTimeout(() => {
        try { sip.stop(); } catch { /* ignore */ }
        sipActive = false;
      }, 300);
      resolve({ success, error });
    };

    sip.start({
      port,
      address: localIp,
      hostname: localIp,
    }, (req: Record<string, unknown>) => {
      if (req.method === 'BYE') {
        sip.send(sip.makeResponse(req, 200, 'OK'));
        finish(true);
      } else {
        sip.send(sip.makeResponse(req, 200, 'OK'));
      }
    });

    const buildInvite = () => {
      const sdp = makeSdp(localIp);
      return {
        method: 'INVITE',
        uri: targetUri,
        headers: {
          to: { uri: targetUri },
          from: { uri: fromUri, params: { tag: fromTag } },
          'call-id': callId,
          cseq: { method: 'INVITE', seq: cseq++ },
          contact: [{ uri: `sip:${botUser}@${localIp}` }],
          'max-forwards': 70,
          'content-type': 'application/sdp',
          'content-length': Buffer.byteLength(sdp),
        },
        content: sdp,
      };
    };

    const sendCancel = (rq: Record<string, unknown>) => {
      const headers = rq.headers as Record<string, unknown>;
      const cseqObj = headers.cseq as { seq: number };
      sip.send(
        {
          method: 'CANCEL',
          uri: targetUri,
          headers: {
            to: headers.to,
            from: headers.from,
            'call-id': callId,
            cseq: { method: 'CANCEL', seq: cseqObj.seq },
            'max-forwards': 70,
            'content-length': 0,
          },
        },
        () => finish(true),
      );
    };

    const sendBye = () => {
      sip.send(
        {
          method: 'BYE',
          uri: targetUri,
          headers: {
            to: toHeader,
            from: fromHeader,
            'call-id': callId,
            cseq: { method: 'BYE', seq: cseq++ },
            'max-forwards': 70,
            'content-length': 0,
          },
        },
        () => finish(true),
      );
    };

    const handleResponse = (rq: Record<string, unknown>, rs: Record<string, unknown>) => {
      if (done) return;

      const status = rs.status as number;
      const rsHeaders = rs.headers as Record<string, unknown>;
      const rqHeaders = rq.headers as Record<string, unknown>;

      if (status === 100 || status === 110) return;

      if (status === 180 || status === 183) {
        logger.info({ target: targetUri }, 'SIP: phone is ringing');
        toHeader = rsHeaders.to;
        fromHeader = rqHeaders.from;
        ringTimer = setTimeout(() => {
          if (!callAnswered) sendCancel(rq);
          else sendBye();
        }, ringDuration);
      } else if (status === 200) {
        callAnswered = true;
        toHeader = rsHeaders.to;
        fromHeader = rqHeaders.from;
        const cseqObj = rqHeaders.cseq as { seq: number };
        sip.send({
          method: 'ACK',
          uri: targetUri,
          headers: {
            to: rsHeaders.to,
            from: rqHeaders.from,
            'call-id': callId,
            cseq: { method: 'ACK', seq: cseqObj.seq },
            'max-forwards': 70,
            'content-length': 0,
          },
        });
        setTimeout(sendBye, 500);
      } else if (status === 487) {
        finish(true);
      } else if (status === 603) {
        // Declined by user — still a success (alert was delivered)
        finish(true);
      } else if (status >= 400) {
        logger.error({ status, reason: rs.reason }, 'SIP call failed');
        finish(false, `SIP ${status}: ${rs.reason}`);
      }
    };

    const rq = buildInvite();
    logger.info({ target: targetUri, port }, 'SIP call initiated');
    sip.send(rq, (rs: Record<string, unknown>) => {
      handleResponse(rq, rs);
    });
  });
}
