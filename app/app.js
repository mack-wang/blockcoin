const bodyParser = require('body-parser');
const express = require('express');
const _ = require('lodash');
const blockchain = require('./blockchain');
const p2p = require('./p2p');
const transactionPool = require('./transactionPool');
const wallet = require('./wallet');
// http 用户对区块、钱包的操作
const httpPort = parseInt(process.env.HTTP_PORT) || 3001;

// p2p websocket 实时同步与本站点所有用户的区块到最新区块
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
    // 根据交易id查询交易data信息(非查找区块)
    // "id": "b7984e3306acb270af7c7ab2e83a9600827d36d942761debf8f9ff97653161f8"
    app.get('/transaction/:id', (req, res) => {
        const tx = _(blockchain.getBlockchain())// 获取区块链
            .map(blocks => blocks.data) // 数据map化
            .flatten() // 数据展开
            .find({id: req.params.id}); // 根据id 找到区块的data
        res.send(tx);
    });

    // 根据用户地址查找余额
    // 每当你的比特币地址收到一笔交易款，比特币网络就改变你的地址。这是为了鼓励你对新交易使用新地址以提高匿名性。
    // 你所有的旧有地址依旧可用。
    // 并且使用任意一个你的地址都可以查询到你所有记录
    // 挖矿获得奖励不会改变你的地址
    app.get('/address/:address', (req, res) => {
        const unspentTxOuts = _.filter(blockchain.getUnspentTxOuts(), uTxO => uTxO.address === req.params.address);
        res.send({unspentTxOuts});
    });


    // 查找所有人未花出去的余额的区块data详情
    app.get('/unspentTransactionOutputs', (req, res) => {
        res.send(blockchain.getUnspentTxOuts());
    });

    // 查找我未花出去的余额的区块data详情
    app.get('/myUnspentTransactionOutputs', (req, res) => {
        res.send(blockchain.getMyUnspentTransactionOutputs());
    });

    // 直接发送区块数据参数，请求写入区块，进入计算，开始挖矿，若计算成功，则由我把交易数据写入区块，并获得50个币的奖励
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

    // 根据我的钱包的数据，生成区块数据参数，接下来同上/mineRawBlock
    app.post('/mineBlock', (req, res) => {
        const newBlock = blockchain.generateNextBlock();
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    // 我的钱包余额,仅显示总数量，即我拥有的总币数
    app.get('/balance', (req, res) => {
        const balance = blockchain.getAccountBalance();
        res.send({balance});
    });

    // 显示我的最新公开的地址（即钱包账户，收款地址）
    app.get('/address', (req, res) => {
        const address = wallet.getPublicFromWallet();
        res.send({address});
    });

    // 我的交易，付款amount个币给address账号，并生成区块
    app.post('/mineTransaction', (req, res) => {
        const address = req.body.address;
        const amount = req.body.amount;
        try {
            // 根据交易记录生成区块
            const resp = blockchain.generatenextBlockWithTransaction(address, amount);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });

    // 发送交易到交易池，排队
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

    // 查看交易池所有交易
    app.get('/transactionPool', (req, res) => {
        res.send(transactionPool.getTransactionPool());
    });

    // 查看当前所有连接websocket的用户
    app.get('/peers', (req, res) => {
        res.send(p2p.getSockets().map(s => `${s._socket.remoteAddress}:${s._socket.remotePort}`));
    });

    // 添加websocket连接用户
    app.post('/addPeer', (req, res) => {
        p2p.connectToPeers(req.body.peer);
        res.send();
    });

    // 停止服务
    app.post('/stop', (req, res) => {
        res.send({msg: 'stopping server'});
        process.exit();
    });

    // 显示我正在使用的端口
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
