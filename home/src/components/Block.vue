<template>
  <div v-if="block.hash">

    <h5>区块 Block #{{ block.index }}</h5>
    <table>
      <tbody>
      <tr>
        <td>当前哈希值 Hash</td>
        <td>{{ block.hash }}</td>
      </tr>
      <tr>
        <td>前一个块的哈稀值 Previous hash</td>
        <td>{{ block.previousHash}}</td>
      </tr>
      <tr>
        <td>时间戳 Timestamp</td>
        <td>{{ block.timestamp}}</td>
      </tr>
      <tr>
        <td>难度值 Difficulty</td>
        <td>{{ block.difficulty}}</td>
      </tr>
      <tr>
        <td>随机次数 Nonce</td>
        <td>{{ block.nonce}}</td>
      </tr>
      <tr>
        <td>交易事务数量 Number of transactions</td>
        <td>{{ block.data.length}}</td>
      </tr>

      </tbody>
    </table>
    <h5>交易事务 Transactions</h5>
    <div class="transaction" v-for="tx in block.data">
      <div class="row">
        <router-link :to="{ name: 'Transaction', params: { id: tx.id }}"> <span >{{ tx.id }}</span></router-link>

      </div>
      <div class="row">
        <div class="five columns">
          <div v-for="txIn in tx.txIns">
            <div v-if="txIn.signature === ''">coinbase</div>
            <div class="break-word" v-else>{{ txIn.txOutId }} {{ txIn.txOutIndex }}</div>
          </div>
        </div>
        <div class="one columns">
          ->
        </div>
        <div class="six columns">
          <div class="row" v-for="txOut in tx.txOuts">
            <div class="break-word"><router-link :to="{ name: 'Address', params: {address: txOut.address}}">
              <span>{{ txOut.address }}</span>
            </router-link>  amount: {{ txOut.amount}} </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
  export default {
    name: 'Block',
    data() {
      return {
        block :{}
      }
    },
    created() {
      this.getBlock(this.$route.params.id)
    },
    methods: {
      getBlock: function (hash) {
        this.$http.get('/api/block/' + hash)
          .then(resp => {
            this.block = resp.data;
          })
      },
      trimAddress: function(address) {
        return address.substr(0,24) + '...';
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
