import { env } from '../config/index.js';
import { logger } from '../utils/index.js';
import os from 'os';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sip = require('@vexyl.ai/sip');

export interface SipRingResult {
  success: boolean;
  error?: string;
}

export interface SipMessageResult {
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

// Persistent stack — started once, shared by MESSAGE and INVITE
let stackStarted = false;
let localIp = '127.0.0.1';
let stackPort = 5060;
let activeCallFinish: ((success: boolean, error?: string) => void) | null = null;
let sipActive = false;

function ensureStack() {
  if (stackStarted) return;
  localIp = getLocalIp();
  stackPort = 5060 + Math.floor(Math.random() * 4000);

  sip.start({
    port: stackPort,
    address: localIp,
    hostname: localIp,
  }, (req: Record<string, unknown>) => {
    if (req.method === 'BYE') {
      sip.send(sip.makeResponse(req, 200, 'OK'));
      if (activeCallFinish) {
        activeCallFinish(true);
        activeCallFinish = null;
      }
    } else {
      sip.send(sip.makeResponse(req, 200, 'OK'));
    }
  });

  stackStarted = true;
}

export async function sendSipMessage(text: string): Promise<SipMessageResult> {
  ensureStack();

  const botUser = env.SIP_BOT_USER!;
  const botDomain = env.SIP_BOT_DOMAIN!;
  const targetUser = env.SIP_TARGET_USER!;
  const targetDomain = env.SIP_TARGET_DOMAIN!;
  const targetUri = `sip:${targetUser}@${targetDomain}`;
  const fromUri = `sip:${botUser}@${botDomain}`;

  const rq = {
    method: 'MESSAGE',
    uri: targetUri,
    headers: {
      to: { uri: targetUri },
      from: { uri: fromUri, params: { tag: crypto.randomBytes(4).toString('hex') } },
      'call-id': `${crypto.randomUUID()}@${localIp}`,
      cseq: { method: 'MESSAGE', seq: 1 },
      'max-forwards': 70,
      'content-type': 'text/plain;charset=UTF-8',
      'content-length': Buffer.byteLength(text),
    },
    content: text,
  };

  logger.info({ target: targetUri }, 'SIP message sending');

  return new Promise((resolve) => {
    sip.send(rq, (rs: Record<string, unknown>) => {
      const status = rs.status as number;
      if (status < 200) return;
      if (status >= 200 && status < 300) {
        resolve({ success: true });
      } else {
        logger.warn({ status, reason: rs.reason }, 'SIP message delivery uncertain');
        resolve({ success: false, error: `SIP ${status}: ${rs.reason}` });
      }
    });
  });
}

export async function ringViaSip(): Promise<SipRingResult> {
  if (sipActive) {
    return { success: false, error: 'SIP call already in progress' };
  }

  ensureStack();
  sipActive = true;

  const botUser = env.SIP_BOT_USER!;
  const botDomain = env.SIP_BOT_DOMAIN!;
  const targetUser = env.SIP_TARGET_USER!;
  const targetDomain = env.SIP_TARGET_DOMAIN!;
  const ringDuration = env.SIP_RING_DURATION_MS;

  const targetUri = `sip:${targetUser}@${targetDomain}`;
  const fromUri = `sip:${botUser}@${botDomain}`;
  const callId = `${crypto.randomUUID()}@${localIp}`;
  const fromTag = crypto.randomBytes(4).toString('hex');

  let cseq = 1;
  let done = false;
  let callAnswered = false;
  let ringTimer: NodeJS.Timeout | undefined;
  let toHeader: unknown = null;
  let fromHeader: unknown = null;

  return new Promise((resolve) => {
    const finish = (success: boolean, error?: string) => {
      if (done) return;
      done = true;
      clearTimeout(ringTimer);
      activeCallFinish = null;
      sipActive = false;
      resolve({ success, error });
    };

    activeCallFinish = finish;

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
      sip.send({
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
      }, () => finish(true));
    };

    const sendBye = () => {
      sip.send({
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
      }, () => finish(true));
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
        finish(true);
      } else if (status >= 400) {
        logger.error({ status, reason: rs.reason }, 'SIP call failed');
        finish(false, `SIP ${status}: ${rs.reason}`);
      }
    };

    const rq = buildInvite();
    logger.info({ target: targetUri }, 'SIP call initiated');
    sip.send(rq, (rs: Record<string, unknown>) => handleResponse(rq, rs));
  });
}
