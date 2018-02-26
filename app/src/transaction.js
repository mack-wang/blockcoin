const CryptoJS = require('crypto-js');
const ecdsa = require('elliptic');
const fs = require('fs');
const _ = require('lodash');

const ec = new ecdsa.ec('secp256k1');
const COINBASE_AMOUNT = 50;

class UnspentTxOut {
    constructor(txOutId, txOutIndex, address, amount) {
        this.txOutId = txOutId;
        this.txOutIndex = txOutIndex;
        this.address = address;
        this.amount = amount;
    }
}

class TxIn {
}

class TxOut {
    constructor(address, amount) {
        this.address = address;
        this.amount = amount;
    }
}


class Transaction {
}

// 生成交易事务id，根据交易事务的收入数据和交易事务的支出数据的内容进行hash得到，所以id即包含交易事务的全部信息hash得到
const getTransactionId = (transaction) => {
    const txInContent = transaction.txIns
        .map(txIn => txIn.txOutId + txIn.txOutIndex)
        .reduce((a, b) => a + b, '');
    const txOutContent = transaction.txOuts
        .map(txOut => txOut.address + txOut.amount)
        .reduce((a, b) => a + b, '');
    return CryptoJS.SHA256(txInContent + txOutContent).toString();
};

// 验证交易事务是否有效
const validateTransaction = (transaction, aUnspentTxOuts) => {
    if (!isValidTransactionStructure(transaction)) {
        return false;
    }
    if (getTransactionId(transaction) !== transaction.id) {
        console.log(`invalid tx id: ${transaction.id}`);
        return false;
    }
    const hasValidTxIns = transaction.txIns
        .map(txIn => validateTxIn(txIn, transaction, aUnspentTxOuts))
        .reduce((a, b) => a && b, true);
    if (!hasValidTxIns) {
        console.log(`some of the txIns are invalid in tx: ${transaction.id}`);
        return false;
    }
    const totalTxInValues = transaction.txIns
        .map(txIn => getTxInAmount(txIn, aUnspentTxOuts))
        .reduce((a, b) => (a + b), 0);
    const totalTxOutValues = transaction.txOuts
        .map(txOut => txOut.amount)
        .reduce((a, b) => (a + b), 0);
    if (totalTxOutValues !== totalTxInValues) {
        console.log(`totalTxOutValues !== totalTxInValues in tx: ${transaction.id}`);
        return false;
    }
    return true;
};

// 验证交易事务
const validateBlockTransactions = (aTransactions, aUnspentTxOuts, blockIndex) => {
    // 交易事务的第一笔即为coinbase
    const coinbaseTx = aTransactions[0];
    if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
        console.log(`invalid coinbase transaction: ${JSON.stringify(coinbaseTx)}`);
        return false;
    }
    // check for duplicate txIns. Each txIn can be included only once
    const txIns = _(aTransactions)
        .map(tx => tx.txIns)
        .flatten()
        .value();
    if (hasDuplicates(txIns)) {
        return false;
    }
    // all but coinbase transactions
    const normalTransactions = aTransactions.slice(1);
    return normalTransactions.map(tx => validateTransaction(tx, aUnspentTxOuts))
        .reduce((a, b) => (a && b), true);
};
const hasDuplicates = (txIns) => {
    const groups = _.countBy(txIns, txIn => txIn.txOutId + txIn.txOutIndex);
    return _(groups)
        .map((value, key) => {
            if (value > 1) {
                console.log(`duplicate txIn: ${key}`);
                return true;
            } else {
                return false;
            }
        })
        .includes(true);
};

// 验证coinbase
const validateCoinbaseTx = (transaction, blockIndex) => {
    // 交易是不是为空
    if (transaction == null) {
        console.log('the first transaction in the block must be coinbase transaction');
        return false;
    }

    // 根据交易事务生成交易事务id 判断交易事务是否真实
    if (getTransactionId(transaction) !== transaction.id) {
        console.log(`invalid coinbase tx id: ${transaction.id}`);
        return false;
    }

    // 交易事务长度必须等于1，因为第一笔交易事务是coinbase
    if (transaction.txIns.length !== 1) {
        console.log('one txIn must be specified in the coinbase transaction');
        return;
    }

    // coinbase的输出索引要等于区块的索引
    if (transaction.txIns[0].txOutIndex !== blockIndex) {
        console.log('the txIn signature in coinbase tx must be the block height');
        return false;
    }

    // coinbase的输出长度要为1
    if (transaction.txOuts.length !== 1) {
        console.log('invalid number of txOuts in coinbase transaction');
        return false;
    }

    // 交易事务的数量要等于COINBASE_AMOUNT
    if (transaction.txOuts[0].amount !== COINBASE_AMOUNT) {
        console.log('invalid coinbase amount in coinbase transaction');
        return false;
    }
    return true;
};
const validateTxIn = (txIn, transaction, aUnspentTxOuts) => {
    const referencedUTxOut = aUnspentTxOuts.find(uTxO => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);
    if (referencedUTxOut == null) {
        console.log(`referenced txOut not found: ${JSON.stringify(txIn)}`);
        return false;
    }
    const address = referencedUTxOut.address;
    const key = ec.keyFromPublic(address, 'hex');
    const validSignature = key.verify(transaction.id, txIn.signature);
    if (!validSignature) {
        console.log('invalid txIn signature: %s txId: %s address: %s', txIn.signature, transaction.id, referencedUTxOut.address);
        return false;
    }
    return true;
};
const getTxInAmount = (txIn, aUnspentTxOuts) => {
    return findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts).amount;
};
const findUnspentTxOut = (transactionId, index, aUnspentTxOuts) => {
    return aUnspentTxOuts.find(uTxO => uTxO.txOutId === transactionId && uTxO.txOutIndex === index);
};

// 根据用户地址和下一个区块的索引，创建交易事务
const getCoinbaseTransaction = (address, blockIndex) => {
    const t = new Transaction();
    const txIn = new TxIn();
    txIn.signature = '';
    txIn.txOutId = '';
    txIn.txOutIndex = blockIndex;
    t.txIns = [txIn];
    t.txOuts = [new TxOut(address, COINBASE_AMOUNT)];
    t.id = getTransactionId(t);
    return t;
};

const signTxIn = (transaction, txInIndex, privateKey, aUnspentTxOuts) => {
    const txIn = transaction.txIns[txInIndex];
    const dataToSign = transaction.id;
    const referencedUnspentTxOut = findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts);
    if (referencedUnspentTxOut == null) {
        console.log('could not find referenced txOut');
        throw Error();
    }
    const referencedAddress = referencedUnspentTxOut.address;
    if (getPublicKey(privateKey) !== referencedAddress) {
        console.log('trying to sign an input with private' +
            ' key that does not match the address that is referenced in txIn');
        throw Error();
    }
    const key = ec.keyFromPrivate(privateKey, 'hex');
    const signature = toHexString(key.sign(dataToSign).toDER());
    return signature;
};

const updateUnspentTxOuts = (aTransactions, aUnspentTxOuts) => {
    const newUnspentTxOuts = aTransactions
        .map((t) => {
            return t.txOuts.map((txOut, index) => new UnspentTxOut(t.id, index, txOut.address, txOut.amount));
        })
        .reduce((a, b) => a.concat(b), []);
    const consumedTxOuts = aTransactions
        .map(t => t.txIns)
        .reduce((a, b) => a.concat(b), [])
        .map(txIn => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0));
    const resultingUnspentTxOuts = aUnspentTxOuts
        .filter((uTxO => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts)))
        .concat(newUnspentTxOuts);
    const stat = fs.statSync('./unspentTxOuts');
    // 如果余额数据大于512M则不再允许添加
    if (stat.size < 1024 * 1024 * 512) {
        fs.writeFileSync('./unspentTxOuts', JSON.stringify(resultingUnspentTxOuts));
    }
    return resultingUnspentTxOuts;
};

// 验证并添加交易事务
const processTransactions = (aTransactions, aUnspentTxOuts, blockIndex) => {
    if (!validateBlockTransactions(aTransactions, aUnspentTxOuts, blockIndex)) {
        console.log('invalid block transactions');
        return null;
    }
    return updateUnspentTxOuts(aTransactions, aUnspentTxOuts);
};

const toHexString = (byteArray) => {
    return Array.from(byteArray, (byte) => {
        return (`0${(byte & 0xFF).toString(16)}`).slice(-2);
    }).join('');
};

// 生成公钥，并转成16进制
const getPublicKey = (aPrivateKey) => {
    return ec.keyFromPrivate(aPrivateKey, 'hex').getPublic().encode('hex');
};

const isValidTxInStructure = (txIn) => {
    if (txIn == null) {
        console.log('txIn is null');
        return false;
    } else if (typeof txIn.signature !== 'string') {
        console.log('invalid signature type in txIn');
        return false;
    } else if (typeof txIn.txOutId !== 'string') {
        console.log('invalid txOutId type in txIn');
        return false;
    } else if (typeof txIn.txOutIndex !== 'number') {
        console.log('invalid txOutIndex type in txIn');
        return false;
    } else {
        return true;
    }
};
const isValidTxOutStructure = (txOut) => {
    if (txOut == null) {
        console.log('txOut is null');
        return false;
    } else if (typeof txOut.address !== 'string') {
        console.log('invalid address type in txOut');
        return false;
    } else if (!isValidAddress(txOut.address)) {
        console.log('invalid TxOut address');
        return false;
    } else if (typeof txOut.amount !== 'number') {
        console.log('invalid amount type in txOut');
        return false;
    } else {
        return true;
    }
};

// 验证交易事务的数据结构是否正确
const isValidTransactionStructure = (transaction) => {
    if (typeof transaction.id !== 'string') {
        console.log('transactionId missing');
        return false;
    }
    if (!(transaction.txIns instanceof Array)) {
        console.log('invalid txIns type in transaction');
        return false;
    }
    if (!transaction.txIns
            .map(isValidTxInStructure)
            .reduce((a, b) => (a && b), true)) {
        return false;
    }
    if (!(transaction.txOuts instanceof Array)) {
        console.log('invalid txIns type in transaction');
        return false;
    }
    if (!transaction.txOuts
            .map(isValidTxOutStructure)
            .reduce((a, b) => (a && b), true)) {
        return false;
    }
    return true;
};
// valid address is a valid ecdsa public key in the 04 + X-coordinate + Y-coordinate format
const isValidAddress = (address) => {
    if (address.length !== 130) {
        console.log(address);
        console.log('invalid public key length');
        return false;
    } else if (address.match('^[a-fA-F0-9]+$') === null) {
        console.log('public key must contain only hex characters');
        return false;
    } else if (!address.startsWith('04')) {
        console.log('public key must start with 04');
        return false;
    }
    return true;
};

module.exports = {
    UnspentTxOut,
    TxIn,
    TxOut,
    Transaction,
    getTransactionId,
    validateTransaction,
    hasDuplicates,
    getCoinbaseTransaction,
    signTxIn,
    processTransactions,
    getPublicKey,
    isValidAddress
};
