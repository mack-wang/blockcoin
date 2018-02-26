# blockcoin 愚人云端|区块链云币

通常情况下，交易发起方创建了一笔交易之后，他将使用私钥对这笔交易进行签名，这个签名表示比特币所有者对交易的许可，同时也确保了交易发生后不会被他人修改；随后，这笔交易将被广播到整个比特币网络中，等待确认；当矿工接收到这些交易请求之后，将通过计算哈希值来争取记账权，然后将交易打包成一个区块，并上传到整个区块链当中；当整个网络中有超过六个节点对这些交易进行确认之后，比特币的转账过程就完成了。

#### 1.简介
app、home、wallet三个应用共同组成【区块链云币】应用
app 服务器： 本地运行区块链，同步区块链，提供操作区块链，钱包，查询等服务，作为服务器。
home 区块链查询： 查看区块链每个区块的详细信息。
wallet 钱包： 查看自己云币余额，支付云币给其他用户，挖矿。

#### 2.运行
分别在app/home/wallet三个目录下，分别执行 npm start 即可运行这三个应用


#### 3.操作教程
管理员在www.yurencloud.top域名下开启了愚人云端|区块链云币服务
服务器端
app端口地址：http://www.yurencloud.top:3031  
home端口地址：http://www.yurencloud.top:8081  
wallet端口地址：http://www.yurencloud.top:8080  
对外开放连接的websocket端口为：http://www.yurencloud.top:6001  

现在假设有用户A，用户B想使用云币
1.克隆项目到本地
~~~
git clone https://github.com/mack-wang/blockcoin.git
~~~
2.用户仅开启app,wallet两个项目就可以
在app目录下执行
~~~
npm install
npm start
~~~
在wallet目录下执行
~~~
npm install
npm start
~~~
3.用户要监听服务端对外开放连接的websocket端口，以同步区块链、待登记交易事务
~~~
curl -H "Content-type:application/json" --data '{"peer" : "ws://www.yurencloud.top:6001"}' http://localhost:3002/addPeer
~~~
3.用户可通过服务器提供的home来查看所有区块链，所以不用开启本地的home项目
~~~
http://www.yurencloud.top:8080
~~~
4.用户访问自己的钱包、转账、挖矿
~~~
http://localhost:8080
~~~
