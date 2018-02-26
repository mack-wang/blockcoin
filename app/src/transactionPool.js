const _ = require('lodash');
const transaction = require('./transaction');

// 待登记交易事务队列数组
let transactionPool = [];

// 获取待登记交易事务队列数组
const getTransactionPool = () => {
    return _.cloneDeep(transactionPool);
};

// 添加交易事务到待登记交易事务队列
const addToTransactionPool = (tx, unspentTxOuts) => {
    if (!transaction.validateTransaction(tx, unspentTxOuts)) {
        throw Error('Trying to add invalid tx to pool');
    }
    if (!isValidTxForPool(tx, transactionPool)) {
        throw Error('Trying to add invalid tx to pool');
    }
    console.log('adding to txPool: %s', JSON.stringify(tx));
    transactionPool.push(tx);
};

// 判断交易事务数据是否合法
const hasTxIn = (txIn, unspentTxOuts) => {
    const foundTxIn = unspentTxOuts.find((uTxO) => {
        return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
    });
    return foundTxIn !== undefined;
};

// 更新待登记交易事务队列
const updateTransactionPool = (unspentTxOuts) => {
    const invalidTxs = [];
    for (const tx of transactionPool) {
        for (const txIn of tx.txIns) {
            if (!hasTxIn(txIn, unspentTxOuts)) {
                invalidTxs.push(tx);
                break;
            }
        }
    }

    if (invalidTxs.length > 0) {
        // 将不合法的交易事务从待登记交易事务队列中清除
        console.log('removing the following transactions from txPool: %s', JSON.stringify(invalidTxs));
        transactionPool = _.without(transactionPool, ...invalidTxs);
    }
};

// 获取所有收入数据
const getTxPoolIns = (aTransactionPool) => {
    return _(aTransactionPool)
        .map(tx => tx.txIns)
        .flatten()
        .value();
};


const isValidTxForPool = (tx, aTtransactionPool) => {
    const txPoolIns = getTxPoolIns(aTtransactionPool);
    const containsTxIn = (txIns, txIn) => {
        return _.find(txPoolIns, ((txPoolIn) => {
            return txIn.txOutIndex === txPoolIn.txOutIndex && txIn.txOutId === txPoolIn.txOutId;
        }));
    };
    for (const txIn of tx.txIns) {
        if (containsTxIn(txPoolIns, txIn)) {
            console.log('txIn already found in the txPool');
            return false;
        }
    }
    return true;
};

module.exports = {
    getTransactionPool,
    addToTransactionPool,
    updateTransactionPool
};
