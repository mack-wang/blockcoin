const CryptoJS = require('crypto-js');
const fs = require('fs');
const _ = require('lodash');
const p2p = require('./p2p');
const transaction = require('./transaction');
const transactionPool = require('./transactionPool');
const util = require('./util');
const wallet = require('./wallet');

// 区块结构
class Block {
    constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
}

// 判断当前是否存在区块链文件，如果存在就直接使用
let blockchain = [];
let unspentTxOuts = [];
if (fs.existsSync('./blockchain')) {
    blockchain = JSON.parse(fs.readFileSync('./blockchain'));

} else {
    // 初始交易事务结构（即初始区块又称创世区块的data数据）
    const genesisTransaction = {
        txIns: [{signature: '', txOutId: '', txOutIndex: 0}],
        txOuts: [{
            address: '04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a',
            amount: 50,
        }],
        id: 'e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3',
    };

// 生成初始区块
    const genesisBlock = new Block(0, '91a73664bc84c0baa1fc75ea6e4aa6d1d20c5df664c724e3159aefc2e1186627', '', 1465154705, [genesisTransaction], 0, 0);

// 初始化区块链
    blockchain = [genesisBlock];

// the unspent txOut of genesis block is set to unspentTxOuts on startup
// 将初始交易事务发送到待登记交易事务队列中
    unspentTxOuts = transaction.processTransactions(blockchain[0].data, [], 0);
}


const getBlockchain = () => blockchain;

const getUnspentTxOuts = () => _.cloneDeep(unspentTxOuts);

// and txPool should be only updated at the same time
const setUnspentTxOuts = (newUnspentTxOut) => {
    console.log('replacing unspentTxouts with: %s', newUnspentTxOut);
    unspentTxOuts = newUnspentTxOut;
};

// 获取最新的区块
const getLatestBlock = () => blockchain[blockchain.length - 1];

// 区块生成的间隔时间10秒
const BLOCK_GENERATION_INTERVAL = 10;

// 每间隔10个块区块，调整生成区块的难度值
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10;

// 获取难度值
const getDifficulty = (aBlockchain) => {
    // 获取最新一个区块
    const latestBlock = aBlockchain[blockchain.length - 1];
    // 如果当前区块为整10个，且不是第1个
    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
        // 检查生成10个区块的时间间隔，动态调整难度值，以平衡难度，使得生成速度保持在10秒/每个区块
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    } else {
        // 如果当前区块为非整10个，保持难度
        return latestBlock.difficulty;
    }
};

// 调整难度
const getAdjustedDifficulty = (latestBlock, aBlockchain) => {
    // 获取倒数第10个区块
    const prevAdjustmentBlock = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    // 期望生成的时间为10秒*10个=100秒
    const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    // 实际所花的时间为10个区块的时间戳的差
    const timeTaken = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    // 如果实际小于期望时间的一半，难度加1
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentBlock.difficulty + 1;
        //如果实际大于期望的两倍，难度减1
    } else if (timeTaken > timeExpected * 2) {
        return prevAdjustmentBlock.difficulty - 1;
    } else {
        // 维持倒数第10个区块的难度
        return prevAdjustmentBlock.difficulty;
    }
};

const getCurrentTimestamp = () => Math.round(new Date().getTime() / 1000);

// 根据blockData,创建原生区块
const generateRawNextBlock = (blockData) => {
    // 获取最新区块
    const previousBlock = getLatestBlock();
    // 获取最新的难度值
    const difficulty = getDifficulty(getBlockchain());
    const nextIndex = previousBlock.index + 1;
    const nextTimestamp = getCurrentTimestamp();
    // 创建新区块
    const newBlock = findBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficulty);

    if (addBlockToChain(newBlock)) {
        p2p.broadcastLatest();
        return newBlock;
    } else {
        return null;
    }
};

// gets the unspent transaction outputs owned by the wallet
const getMyUnspentTransactionOutputs = () => {
    return wallet.findUnspentTxOuts(wallet.getPublicFromWallet(), getUnspentTxOuts());
};

const generateNextBlock = () => {
    const coinbaseTx = transaction.getCoinbaseTransaction(wallet.getPublicFromWallet(), getLatestBlock().index + 1);
    const blockData = [coinbaseTx].concat(transactionPool.getTransactionPool());
    return generateRawNextBlock(blockData);
};

// 根据交易事务生成区块， 收款地址，收款数量
const generatenextBlockWithTransaction = (receiverAddress, amount) => {
    if (!transaction.isValidAddress(receiverAddress)) {
        throw Error('invalid address');
    }
    if (typeof amount !== 'number') {
        throw Error('invalid amount');
    }
    //
    const coinbaseTx = transaction.getCoinbaseTransaction(wallet.getPublicFromWallet(), getLatestBlock().index + 1);
    const tx = wallet.createTransaction(receiverAddress, amount, wallet.getPrivateFromWallet(), getUnspentTxOuts(), transactionPool.getTransactionPool());
    const blockData = [coinbaseTx, tx];
    return generateRawNextBlock(blockData);
};

// 挖矿，实际就是逐一递增nonce值，计算hash,寻找符合条件的hash
// 这一段代码是无限循环执行的，耗费计算量的代码就是这一段，直到找到符合条件nonce值，便拥有登记权，有权把待登记的交易事务写入到区块链中，并通知其他矿工也登记
const findBlock = (index, previousHash, timestamp, data, difficulty) => {
    let nonce = 0;
    while (true) {
        const hash = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
        }
        nonce++;
    }
};
const getAccountBalance = () => {
    return wallet.getBalance(wallet.getPublicFromWallet(), getUnspentTxOuts());
};

// 发送交易事务到待登记交易事务队列，排队
const sendTransaction = (address, amount) => {
    // 创建交易事务
    const tx = wallet.createTransaction(address, amount, wallet.getPrivateFromWallet(), getUnspentTxOuts(), transactionPool.getTransactionPool());
    // 添加到待交易事务队列中
    transactionPool.addToTransactionPool(tx, getUnspentTxOuts());// 新的交易记录，和之前还未处理完的交易记录，二者
    // 广播待交易事务队列，让所有监听本站点的用户都同步待交易事务队列
    p2p.broadCastTransactionPool();
    return tx;
};

const calculateHashForBlock = block => calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);
const calculateHash = (index, previousHash, timestamp, data, difficulty, nonce) => CryptoJS.SHA256(index + previousHash + timestamp + data + difficulty + nonce).toString();
const isValidBlockStructure = (block) => {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'object';
};

// 验证最新区块是不是和区块链顶端区块相邻， 并且区块合法
const isValidNewBlock = (newBlock, previousBlock) => {
    if (!isValidBlockStructure(newBlock)) {
        console.log('invalid block structure: %s', JSON.stringify(newBlock));
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previoushash');
        return false;
    } else if (!isValidTimestamp(newBlock, previousBlock)) {
        console.log('invalid timestamp');
        return false;
    } else if (!hasValidHash(newBlock)) {
        return false;
    }
    return true;
};
const getAccumulatedDifficulty = (aBlockchain) => {
    return aBlockchain
        .map(block => block.difficulty)
        .map(difficulty => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);
};
const isValidTimestamp = (newBlock, previousBlock) => {
    return (previousBlock.timestamp - 60 < newBlock.timestamp)
        && newBlock.timestamp - 60 < getCurrentTimestamp();
};
const hasValidHash = (block) => {
    if (!hashMatchesBlockContent(block)) {
        console.log(`invalid hash, got:${block.hash}`);
        return false;
    }
    if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
        console.log(`block difficulty not satisfied. Expected: ${block.difficulty}got: ${block.hash}`);
    }
    return true;
};
const hashMatchesBlockContent = (block) => {
    const blockHash = calculateHashForBlock(block);
    return blockHash === block.hash;
};

// 判断该hash是否为有效hash
// 先把hash的16进制转成2进制，再判断这个2进制是否是有difficulty个0开头（比如 1，3，100个）
// 比特币中，difficulty的值是会动态改变的，以保持10分钟生成一个块的速度
const hashMatchesDifficulty = (hash, difficulty) => {
    const hashInBinary = util.hexToBinary(hash);
    const requiredPrefix = '0'.repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
};
/*
    Checks if the given blockchain is valid. Return the unspent txOuts if the chain is valid
 */
const isValidChain = (blockchainToValidate) => {
    console.log('isValidChain:');
    console.log(JSON.stringify(blockchainToValidate));
    const isValidGenesis = (block) => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };
    if (!isValidGenesis(blockchainToValidate[0])) {
        return null;
    }
    /*
    Validate each block in the chain. The block is valid if the block structure is valid
      and the transaction are valid
     */
    let aUnspentTxOuts = [];
    for (let i = 0; i < blockchainToValidate.length; i++) {
        const currentBlock = blockchainToValidate[i];
        if (i !== 0 && !isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return null;
        }
        aUnspentTxOuts = transaction.processTransactions(currentBlock.data, aUnspentTxOuts, currentBlock.index);
        if (aUnspentTxOuts === null) {
            console.log('invalid transactions in blockchain');
            return null;
        }
    }
    return aUnspentTxOuts;
};

// 把区块添加到区块链上
const addBlockToChain = (newBlock) => {
    // 检查新区块是不是根据最新区块创建的
    if (isValidNewBlock(newBlock, getLatestBlock())) {

        const retVal = transaction.processTransactions(newBlock.data, getUnspentTxOuts(), newBlock.index);
        if (retVal === null) {
            console.log('block is not valid in terms of transactions');
            return false;
        } else {

            blockchain.push(newBlock);
            setUnspentTxOuts(retVal);
            transactionPool.updateTransactionPool(unspentTxOuts);
            return true;
        }
    }
    return false;
};

const replaceChain = (newBlocks) => {
    const aUnspentTxOuts = isValidChain(newBlocks);
    const validChain = aUnspentTxOuts !== null;
    if (validChain &&
        getAccumulatedDifficulty(newBlocks) > getAccumulatedDifficulty(getBlockchain())) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        blockchain = newBlocks;
        setUnspentTxOuts(aUnspentTxOuts);
        transactionPool.updateTransactionPool(unspentTxOuts);
        p2p.broadcastLatest();
    } else {
        console.log('Received blockchain invalid');
    }
};

const handleReceivedTransaction = (transaction) => {
    transactionPool.addToTransactionPool(transaction, getUnspentTxOuts());
};

exports.Block = Block;
exports.getBlockchain = getBlockchain;
exports.getUnspentTxOuts = getUnspentTxOuts;
exports.getLatestBlock = getLatestBlock;
exports.generateRawNextBlock = generateRawNextBlock;
exports.getMyUnspentTransactionOutputs = getMyUnspentTransactionOutputs;
exports.generateNextBlock = generateNextBlock;
exports.generatenextBlockWithTransaction = generatenextBlockWithTransaction;
exports.getAccountBalance = getAccountBalance;
exports.sendTransaction = sendTransaction;
exports.isValidBlockStructure = isValidBlockStructure;
exports.addBlockToChain = addBlockToChain;
exports.replaceChain = replaceChain;
exports.handleReceivedTransaction = handleReceivedTransaction;
module.exports = exports;
