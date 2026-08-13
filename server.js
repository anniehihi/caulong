const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const clients = []; // Server-Sent Events clients

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // 1. Webhook Endpoint from SePay (POST /api/sepay-webhook)
    if (req.method === 'POST' && req.url === '/api/sepay-webhook') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                console.log('⚡ Received SePay Webhook Payload:', data);

                // Extract transaction details
                const amount = data.transferAmount || data.amount_in || 0;
                const content = data.content || data.transaction_content || '';
                const accNo = data.accountNumber || data.account_number || '';

                // Broadcast transaction event to all open browser windows via SSE
                const payload = JSON.stringify({
                    type: 'SEPAY_TRANSACTION',
                    amount: amount,
                    content: content,
                    accountNumber: accNo,
                    timestamp: new Date().toISOString()
                });

                clients.forEach(client => {
                    client.write(`data: ${payload}\n\n`);
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Webhook processed' }));
            } catch (err) {
                console.error('Error processing webhook:', err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // 2. Server-Sent Events (SSE) Endpoint for real-time browser updates (GET /api/events)
    if (req.method === 'GET' && req.url === '/api/events') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        res.write('retry: 5000\n\n');
        clients.push(res);

        req.on('close', () => {
            const index = clients.indexOf(res);
            if (index !== -1) clients.splice(index, 1);
        });
        return;
    }

    // 3. Serve Static Web Files (index.html, styles.css, app.js)
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 Not Found</h1>');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🏸 BADMINTON SCOREKEEPER & SEPAY SERVER IS RUNNING!`);
    console.log(`👉 Web Interface: http://localhost:${PORT}`);
    console.log(`⚡ SePay Webhook URL: http://localhost:${PORT}/api/sepay-webhook`);
    console.log(`====================================================`);
});
