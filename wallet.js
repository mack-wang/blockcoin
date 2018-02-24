const elliptic = require('elliptic');
const fs = require('fs');
const _ = require('lodash');
const transaction = require('./transaction');

const EC = new elliptic.ec('secp256k1');
const privateKeyLocation = process.env.PRIVATE_KEY || 'node/wallet/private_key';
const getPrivateFromWallet = () => {
    const buffer = fs.readFileSync(privateKeyLocation, 'utf8');
    return buffer.toString();
};

// 获取公钥，即我的钱包的地址
const getPublicFromWallet = () => {
    const privateKey = getPrivateFromWallet();
    const key = EC.keyFromPrivate(privateKey, 'hex');
    return key.getPublic().encode('hex');
};

// 生成私钥
const generatePrivateKey = () => {
    const keyPair = EC.genKeyPair();
    const privateKey = keyPair.getPrivate();
    return privateKey.toString(16);
};

// 初始化钱包
const initWallet = () => {
    // let's not override existing private keys
    // 如果私钥已经存在，说明钱包已经存在，就不要重复初始化
    if (fs.existsSync(privateKeyLocation)) {
        return;
    }
    // 生成私钥
    const newPrivateKey = generatePrivateKey();
    // 写到node/wallet/private_key下
    fs.writeFileSync(privateKeyLocation, newPrivateKey);

    console.log('new wallet with private key created to : %s', privateKeyLocation);
};

// 删除钱包，即删除私钥
const deleteWallet = () => {
    if (fs.existsSync(privateKeyLocation)) {
        fs.unlinkSync(privateKeyLocation);
    }
};

// 获取钱包余额
const getBalance = (address, unspentTxOuts) => {
    return _(findUnspentTxOuts(address, unspentTxOuts))
        .map(uTxO => uTxO.amount)
        .sum();
};

// 获取钱包余额的详细记录数据
const findUnspentTxOuts = (ownerAddress, unspentTxOuts) => {
    return _.filter(unspentTxOuts, uTxO => uTxO.address === ownerAddress);
};

// 查找自己的币，验证余币是否充足，足够支付amount给对方
const findTxOutsForAmount = (amount, myUnspentTxOuts) => {
    let currentAmount = 0;
    const includedUnspentTxOuts = [];
    // 遍历我的未花出去的币
    for (const myUnspentTxOut of myUnspentTxOuts) {
        // 把准备要支付出去的块都放到includedUnspentTxOunts数组中
        includedUnspentTxOuts.push(myUnspentTxOut);
        // 累积已经读取的币的数量
        currentAmount += myUnspentTxOut.amount;
        // 如果已经足够支持，停止遍历，返回支付出去的块数组，和余额
        if (currentAmount >= amount) {
            const leftOverAmount = currentAmount - amount;
            return {includedUnspentTxOuts, leftOverAmount};
        }
    }
    // 不能创建交易，交易要amount个币，你只有myUnspentTxOunts个币
    const eMsg = `${'Cannot create transaction from the available unspent transaction outputs.' +
    ' Required amount:'}${amount}. Available unspentTxOuts:${JSON.stringify(myUnspentTxOuts)}`;
    throw Error(eMsg);
};

// 创建输出币，根据对方地址和我的地址
const createTxOuts = (receiverAddress, myAddress, amount, leftOverAmount) => {
    // 根据对方地址和交易数量，创建交易事务
    const txOut1 = new transaction.TxOut(receiverAddress, amount);
    // 如果余额为0，则直接把交易事务放进数组中
    if (leftOverAmount === 0) {
        return [txOut1];
    } else {
        // 如果余额不为0，则要创建交易余额事务，并把两个事务放到数组中
        const leftOverTx = new transaction.TxOut(myAddress, leftOverAmount);
        return [txOut1, leftOverTx];
    }
};


const filterTxPoolTxs = (unspentTxOuts, transactionPool) => {
    const txIns = _(transactionPool)
        .map(tx => tx.txIns)
        .flatten()
        .value();
    const removable = [];
    for (const unspentTxOut of unspentTxOuts) {
        const txIn = _.find(txIns, (aTxIn) => {
            return aTxIn.txOutIndex === unspentTxOut.txOutIndex && aTxIn.txOutId === unspentTxOut.txOutId;
        });
        if (txIn === undefined) {
        } else {
            removable.push(unspentTxOut);
        }
    }
    return _.without(unspentTxOuts, ...removable);
};

// 创建交易：收款地址，数量，私钥，余额，交易池
const createTransaction = (receiverAddress, amount, privateKey, unspentTxOuts, txPool) => {
    console.log('txPool: %s', JSON.stringify(txPool));
    // 获取16进制公钥，即获取我的地址
    const myAddress = transaction.getPublicKey(privateKey);
    // 我未
    const myUnspentTxOutsA = unspentTxOuts.filter(uTxO => uTxO.address === myAddress);
    const myUnspentTxOuts = filterTxPoolTxs(myUnspentTxOutsA, txPool);
    // filter from unspentOutputs such inputs that are referenced in pool
    const {includedUnspentTxOuts, leftOverAmount} = findTxOutsForAmount(amount, myUnspentTxOuts);
    const toUnsignedTxIn = (unspentTxOut) => {
        const txIn = new transaction.TxIn();
        txIn.txOutId = unspentTxOut.txOutId;
        txIn.txOutIndex = unspentTxOut.txOutIndex;
        return txIn;
    };
    const unsignedTxIns = includedUnspentTxOuts.map(toUnsignedTxIn);
    const tx = new transaction.Transaction();
    tx.txIns = unsignedTxIns;
    tx.txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
    tx.id = transaction.getTransactionId(tx);
    tx.txIns = tx.txIns.map((txIn, index) => {
        txIn.signature = transaction.signTxIn(tx, index, privateKey, unspentTxOuts);
        return txIn;
    });
    return tx;
};

module.exports = {
    getPrivateFromWallet,
    getPublicFromWallet,
    generatePrivateKey,
    initWallet,
    deleteWallet,
    getBalance,
    findUnspentTxOuts,
    createTransaction
};
