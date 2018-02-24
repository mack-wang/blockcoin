const _ = require('lodash');
const transaction = require('./transaction');

// 交易池数组
let transactionPool = [];

// 获取交易池数组
const getTransactionPool = () => {
    return _.cloneDeep(transactionPool);
};

// 添加交易到交易池
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

// 判断交易是否合法
const hasTxIn = (txIn, unspentTxOuts) => {
    const foundTxIn = unspentTxOuts.find((uTxO) => {
        return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
    });
    return foundTxIn !== undefined;
};

// 更新交易池
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
        // 将不合法的交易从交易池中清除
        console.log('removing the following transactions from txPool: %s', JSON.stringify(invalidTxs));
        transactionPool = _.without(transactionPool, ...invalidTxs);
    }
};

// 获取所有输入币
const getTxPoolIns = (aTransactionPool) => {
    return _(aTransactionPool)
        .map(tx => tx.txIns)
        .flatten()
        .value();
};

//
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
