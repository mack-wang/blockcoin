<template>
  <div>
    <h5>钱包地址 Address</h5>
    <h5 class="break-word">{{$route.params.address }}</h5>
    <h5>云币余额 Total amount: {{  totalAmount(addressData.unspentTxOuts) }} </h5>

    <h5>余额来源 Unspent transaction outputs</h5>
    <div class="txOut" v-for="uTxo in addressData.unspentTxOuts">
      <div class="row">txOutId:
        <router-link :to="{ name: 'Transaction', params :{ id: uTxo.txOutId}}"><span>{{ uTxo.txOutId }}</span>
        </router-link></div>
      <div class="row">txOutIndex: {{ uTxo.txOutIndex }}</div>
      <div class="row">amount: {{ uTxo.amount }}</div>
      <div class="row break-word">address: {{ uTxo.address }}</div>
    </div>
  </div>
</template>

<script>
  export default {
    name: 'Transaction',
    data() {
      return {
        addressData :{}
      }
    },
    created() {
      this.getAddress(this.$route.params.address)
    },
    methods: {
      getAddress: function (address) {
        this.$http.get('/api/address/' + address)
          .then(resp => {
            this.addressData = resp.data;
          })
      },
      totalAmount: function(unspentOutputs) {

        return _(unspentOutputs)
          .map(uTxo => uTxo.amount)
          .sum();
      },
      trimAddress: function(address) {
        return address.substr(0,24) + '...';
      }
    }
  }
</script>

<style scoped>
  .txOut {
    padding: 1em;
    margin-bottom: 1em;
    background-color: gainsboro;
  }
</style>
