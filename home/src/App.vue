<template>
  <div id="app">
    <div class="container"><h1><a class="header-link" href="/">区块链云币</a></h1>
      <router-view :key="$route.fullPath"/>
    </div>
  </div>
</template>

<script>
  export default {
    name: 'app',
    created() {

    },
  }
</script>

<style>
  body {
    font-family: "Helvetica Neue",Helvetica,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","微软雅黑",Arial,sans-serif;;
  }

  .header-link {
    font-size: 30px;
    font-weight: bold;
    color: black;
    text-decoration: none; /* no underline */
  }

  .break-word {
    word-wrap: break-word;
  }
</style>
