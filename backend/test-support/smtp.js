import net from 'node:net';
import { once } from 'node:events';
import assert from 'node:assert/strict';

// Only a loopback TCP receiver is used by account email tests.
export async function startSmtpReceiver() {
    const inbox = { messages: [], reject: false, delay: false, pending: [] }, sockets = new Set();
    const server = net.createServer(socket => {
        sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
        socket.setEncoding('utf8'); socket.write('220 local-test SMTP\r\n');
        let buffer = '', inData = false, message = '';
        socket.on('data', chunk => {
            buffer += chunk;
            let newline;
            while ((newline = buffer.indexOf('\r\n')) !== -1) {
                const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 2);
                if (inData) {
                    if (line === '.') {
                        inData = false;
                        const accepted = message;
                        const finish = () => { if (inbox.reject) socket.write('550 simulated delivery failure\r\n'); else { inbox.messages.push(accepted); socket.write('250 accepted\r\n'); } };
                        if (inbox.delay) inbox.pending.push(finish); else finish();
                    } else message += line + '\r\n';
                } else if (line.startsWith('EHLO')) socket.write('250-local-test\r\n250 AUTH PLAIN\r\n');
                else if (line.startsWith('AUTH')) socket.write('235 authenticated\r\n');
                else if (line === 'DATA') { inData = true; message = ''; socket.write('354 send message\r\n'); }
                else if (line === 'QUIT') socket.end('221 bye\r\n');
                else socket.write('250 ok\r\n');
            }
        });
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port), SMTP_USER: 'smtp@local.test', SMTP_PASS: 'local-test', SMTP_SECURE: 'false', GMAIL_USER: '', GMAIL_APP_PASS: '', EMAIL_FROM: 'CINEMA <smtp@local.test>' });
    return { inbox, async close() { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}

export function emailedPassword(message) {
    const password = message.replace(/=\r\n/g, '').match(/Aa1![A-Za-z0-9_-]{24}/)?.[0];
    assert.ok(password, 'SMTP message contains the generated password');
    return password;
}
