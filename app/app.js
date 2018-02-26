const bodyParser = require('body-parser');
const express = require('express');
const _ = require('lodash');
const blockchain = require('./src/blockchain');
const p2p = require('./src/p2p');
const transactionPool = require('./src/transactionPool');
const wallet = require('./src/wallet');
// http 用户操作区块和钱包
const httpPort = parseInt(process.env.HTTP_PORT) || 3001;

// p2p websocket 实时同步监听本站点的所有用户的区块链到最新区块
const p2pPort = parseInt(process.env.P2P_PORT) || 6001;
const app = express();

const initHttpServer = (myHttpPort) => {
    app.use(bodyParser.json());
    app.use((err, req, res, next) => {
        if (err) {
            res.status(400).send(err.message);
        }
    });
    // 获取全部区块链
    app.get('/blocks', (req, res) => {
        res.send(blockchain.getBlockchain());
    });
    // 根据hash查询单个区块
    app.get('/block/:hash', (req, res) => {
        const block = _.find(blockchain.getBlockchain(), {hash: req.params.hash});
        res.send(block);
    });

    // 根据交易事务id查询交易事务data信息
    app.get('/transaction/:id', (req, res) => {
        const tx = _(blockchain.getBlockchain())
            .map(blocks => blocks.data)
            .flatten()
            .find({id: req.params.id});
        res.send(tx);
    });

    // 根据用户地址查找余额
    // 每当你的云币地址收到一笔交易款，云币网络就改变你的地址。这是为了鼓励你对新交易使用新地址以提高匿名性。
    // 你所有的旧有地址依旧可用。
    // 挖矿获得奖励不会改变你的地址
    app.get('/address/:address', (req, res) => {
        const unspentTxOuts = _.filter(blockchain.getUnspentTxOuts(), uTxO => uTxO.address === req.params.address);
        res.send({unspentTxOuts});
    });


    // 查找所有用户未花出去的余额的区块data详情
    app.get('/unspentTransactionOutputs', (req, res) => {
        res.send(blockchain.getUnspentTxOuts());
    });

    // 查找用户未花出去的余额的区块data详情
    app.get('/myUnspentTransactionOutputs', (req, res) => {
        res.send(blockchain.getMyUnspentTransactionOutputs());
    });

    // 直接发送区块数据参数，请求写入区块，进入计算，开始挖矿，若计算成功，则由用户把交易数据写入区块，并获得50个云币的奖励
    app.post('/mineRawBlock', (req, res) => {
        if (req.body.data == null) {
            res.send('data parameter is missing');
            return;
        }
        const newBlock = blockchain.generateRawNextBlock(req.body.data);
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    // 根据用户的钱包的数据，生成区块数据参数，接下来同上/mineRawBlock
    app.post('/mineBlock', (req, res) => {
        const newBlock = blockchain.generateNextBlock();
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    // 用户钱包余额,仅显示总数量，即用户拥有的总云币数
    app.get('/balance', (req, res) => {
        const balance = blockchain.getAccountBalance();
        res.send({balance});
    });

    // 显示用户最新公开的地址（即钱包账户，收款地址）
    app.get('/address', (req, res) => {
        const address = wallet.getPublicFromWallet();
        res.send({address});
    });

    // 用户的交易，付款amount个云币给address账号，并生成交易事务
    app.post('/mineTransaction', (req, res) => {
        const address = req.body.address;
        const amount = req.body.amount;
        try {
            // 根据交易事务生成区块
            const resp = blockchain.generatenextBlockWithTransaction(address, amount);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });

    // 发送交易事务到待登记交易事务，排队
    app.post('/sendTransaction', (req, res) => {
        try {
            const address = req.body.address;
            const amount = req.body.amount;
            if (address === undefined || amount === undefined) {
                throw Error('invalid address or amount');
            }
            const resp = blockchain.sendTransaction(address, amount);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });

    // 查看所有待登记交易事务
    app.get('/transactionPool', (req, res) => {
        res.send(transactionPool.getTransactionPool());
    });

    // 查看正在监听当前用户的其他用户（A用户监听了B用户，那么B用户挖到矿并添加到区块链上，A用户的区块链也会更新）
    app.get('/peers', (req, res) => {
        res.send(p2p.getSockets().map(s => `${s._socket.remoteAddress}:${s._socket.remotePort}`));
    });

    // 添加监听对象
    app.post('/addPeer', (req, res) => {
        p2p.connectToPeers(req.body.peer);
        res.send();
    });

    // 停止服务
    app.post('/stop', (req, res) => {
        res.send({msg: 'stopping server'});
        process.exit();
    });

    // 显示用户正在使用的端口
    app.listen(myHttpPort, () => {
        console.log(`Listening http on port: ${myHttpPort}`);
    });

    app.get('/test',(req, res)=>{
        res.send({data: 2})
    });
};
// 开启http服务
initHttpServer(httpPort);
// 开户websocket服务
p2p.initP2PServer(p2pPort);
// 初始化钱包
wallet.initWallet();

module.exports = app;
