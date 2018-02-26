<template>
  <div>
    <div class="row break-word">
      你的钱包公开地址 Your public address: <h5 class="break-word">{{ address }}</h5>
    </div>
    <div class="row">
      你的余额 Your balance: <h5>{{ balance }}</h5>
    </div>
    <br>
    <h5>云币付款 Send coins</h5>
    <form>
      <div class="row">
        <div class="ten columns">
          <label for="receiverAddress">收款钱包地址 Receiver address</label>
          <input v-model="receiverAddress" class="u-full-width" type="text" placeholder="04f72a4541275aeb4344a8b04..." id="receiverAddress">
        </div>
        <div class="two columns">
          <label for="amount">支付数量 Amount</label>
          <input v-model="receiverAmount" class="u-full-width" type="number" placeholder="0" id="amount">
        </div>
      </div>
      <button v-on:click="sendTransaction" class="button-primary">确认支付 Send</button>
    </form>
    <h5>待登记交易事务队列 Transaction pool</h5>
    <div class="transaction" v-for="tx in transactionPool">
      <div class="row">
        <span >TxId: {{ tx.id }}</span>
      </div>
      <div class="row">
        <div class="five columns">
          <div v-for="txIn in tx.txIns">
            <div v-if="txIn.signature === ''">云币初始币 coinbase</div>
            <div class="break-word" v-else>{{ txIn.txOutId }} {{ txIn.txOutIndex }}</div>
          </div>
        </div>
        <div class="one columns">
          ->
        </div>
        <div class="six columns">
          <div class="row" v-for="txOut in tx.txOuts">
            <div class="break-word">
              <span>钱包地址 address: {{ txOut.address }}</span>
              交易数量 amount: {{ txOut.amount}} </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="transactionPool.length === 0"><span>没有待登记交易事务 No transactions in transaction pool</span></div>
    <br>
    <h5>我的区块 Mine block</h5>
    <button v-on:click="mineBlock" class="button-primary">点击开始挖矿 Click to mine block</button>
    <div>

    </div>
  </div>
</template>

<script>
  export default {
    name: 'FrontPage',
    data() {
      return {
        'address': null,
        'balance': null,
        'transactionPool': [],
        'receiverAddress': null,
        'receiverAmount' : null
      }
    },
    created() {
      this.init();
    },
    methods: {
      init: function() {
        this.getAddress();
        this.getBalance();
        this.getTransactionPool();
      },
      getAddress: function () {
        this.$http.get('/api/address')
          .then(resp => {
            this.address = resp.data.address;
          })
      },
      getBalance: function () {
        this.$http.get('/api/balance')
          .then(resp => {
            this.balance = resp.data.balance;
          })
      },
      sendTransaction: function() {
        this.$http.post('/api/sendTransaction',
          {'amount' : parseInt(this.receiverAmount), 'address' : this.receiverAddress}
          )
          .then(() => {
            this.receiverAmount = null;
            this.receiverAddress = null;
            this.init();
          })
      },
      mineBlock: function() {
        this.$http.post('/api/mineBlock')
          .then(() => {
            this.init();
        })
      },
      getTransactionPool: function() {
        this.$http.get('/api/transactionPool')
          .then((resp) => {
            this.transactionPool = resp.data;
          });
      }

    }
  }
</script>


<style scoped>
  .transaction {
    padding: 1em;
    margin-bottom: 1em;
    background-color: gainsboro;
  }
</style>
