# Redis 数据清理
本模块是 [sdb-schedule] 的插件，用于自动清理 redis 数据。 sdb-schedule 也提供了APP [sdb-schedule-ui]，进行图形化操作。
可在这里进行下载 [download]。
- 支持 正则表达式
- 支持 ZSET,LIST 的清理

![Setting][idSet]


## 安装

### step 1: install module
Using npm:

    $ npm install scp-cleanRedis

### step 2: config in sdb-schedule

- 添加 Job，设置 Fun 参数为 **"scp-cleanRedis"**.


## 更新记录
### 0.1.3
增加对 hash field的清理功能，通过判断域是否满足条件

### 0.0.2
修复只能清理一次的Bug。

### 0.0.1
实现功能。

## 配置 
  配置文件采用json格式，定义了每个匹配，结构大致如下:

```javascript
 {
	"redis":{ "host":"127.0.0.1","port":6379 },
	"keys":[
		{
			"name":"<descript info>",
			"type":"<zset|list|key>",
			"match":"<redis keys synctax>",
			"action":{
				"style" : "<rank|score|rem|trim>",  // rank|score for ZSET;rem|trim for LIST
				"min"   : "<js expression>",
				"max"   : "<js expression>",
				"count" : "<js expression>", // optional ,FOR LIST rem
				"value" : "<js expression>", // optional ,FOR LIST rem
				"expire":36000,    // optional, for key type

				"regex":"<regex>",
				"attr":[
					{
						"matchType":"<int|string|dateStamp>",
						"min"    : "<val0 | js expression>",
						"max"    : "[val0 | js expression]"
					}
				]
			}
		}
	]
};

```

### redis
配置操作的redis数据库的地址
- **host**, redis服务器的IP；
- **port**, redis服务器的端口号；

### keys
数组，清理的redis键的配置。

* **name**,清理操作描述信息
* **type**,清理类型
	- **zset**,清理 ZSET 数据
	- **list**，清理 LIST 数据
	- **key**，清理redis key,通过设置超期值来实现
	- **hash**，清理redis hash field,通过 hdel 实现，检测hash key的域是否满足删除条件
* **match**，查找匹配的redis键，参照 redis keys 的语法。
* **action**，操作
	- **style**，操作的方式,支持 ( rank|score|rem|trim )。
		- **rank**，type为 *ZSET* 时有效，对应调用 *zremrangebyrank* 实现数据的清理
		- **score**,type为 *ZSET* 时有效，对应调用 *zremrangebyscore* 实现数据的清理
		- **rem**，type为 *LIST* 时有效，对应调用 *lrem* 实现数据的清理
		- **trim**，type为 *LIST* 时有效，对应调用 *ltrim* 实现数据的清理
	- **min**，js表达式，移除范围低值，用于 ZSET 和 LIST 的 trim
	- **max**，js表达式，移除范围高值，用于 ZSET 和 LIST 的 trim
	- **count**，js表达式，移除数量，用于 LIST 的 rem
	- **value**，js表达式，移除数值，用于 LIST 的 rem
	- **expire**, 数字，单位秒， type为key时有效，设置 key 的超期值
	- **regex**， 键的匹配正则表达式，支持子匹配，子匹配的匹配判断参数在 下面的 attr里面设置
    - **attr**, 子匹配属性
		- **matchType**，匹配类型，支持整形(int)，字符串(string)，时间戳(dateStamp)
			- **min**，匹配范围低值
			- **max**，匹配范围高值，对 string类型无效


下面是配置的详细例子

```javascript
{
	"redis":{ "host":"127.0.0.1","port":6379 },
	"keys":[
		{
			"name":"清理zset类型",
			"type":"zset",
			"match":"*:Pool:his",
			"action":{
				"style" : "score",
				"min"   : "'-inf'",
				"max"   : "parseInt((new Date()).valueOf()/1000) - 86400 * 30",
				"regex":"([0-9]{8}):*",
				"attr":[
					{
						"matchType":"string",
						"min"    : "50901800",
						"max"    : ""
					}
				]
			}
		},
		{
			"name":"清理 List",
			"type":"list",
			"match":"brnn:winls",
			"action":{
				"style":"trim",
				"min"  : 0,
				"max"  : 3
			}
		},
		{
            "name":"清理Hash",
            "type":"hash",
            "match":"*:recy",
            "action":{
				"regex":"([0-9]{8})",
                "attr":[
                       {
                       "matchType":"dateStamp",
                       "min":"0",
                       "max":"(new Date()).valueOf() - 86400000 * 30"
                       }
                   ]
            }
        },
		{
			"name":"清理key",
			"type":"key",
			"match":"rcard:20??????:*:*",
			"action":{
				"expire":36000,
				"regex":"([0-9]{8}):([0-9]{1,}):([0-9]{1,})",
				"attr":[
					{
						"matchType":"dateStamp",
						"min"    : "0",
						"max"    : "(new Date()).valueOf() - 86400 * 30000"
					},
					{
						"matchType":"int",
						"min"    : "0",
						"max"    : "3"
					},
					{
						"matchType":"string",
						"min"    : "5",
						"max"    : ""
					}
				]
			}
		}
	]

};
```


## Copyright and license

Copyright 2016+ shudingbo

Licensed under the **[MIT License]**.

[node-schedule]: https://github.com/node-schedule/node-schedule
[node-redis]:https://github.com/NodeRedis/node_redis
[cron-parser]: https://github.com/harrisiirak/cron-parser
[sdb-schedule-ui]: https://github.com/shudingbo/sdb-schedule-ui
[sdb-schedule]: https://github.com/shudingbo/sdb-schedule
[download]: https://github.com/shudingbo/sdb-public/blob/master/sdb-schedule-ui/sdb-schedule-ui.7z
[idMain]: https://github.com/shudingbo/sdb-public/blob/master/sdb-schedule-ui/main.jpg  "Main"
[idSet]: https://github.com/shudingbo/sdb-public/blob/master/sdb-schedule-ui/setting.jpg  "Setting"
