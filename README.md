# Chinese Input Method Practicing Web 中文输入法练习网页

本项目提供一个简单、开箱即用的中文输入法练习网页，基于 [RIME 方案](https://rime.im/)。

## 使用方法

单击 GitHub 页面提供的绿色 Code 按键，在下拉菜单中单击 Download ZIP 下载压缩包到本地。解压到某一目录后，终端打开此目录并运行命令：

```bash  
./serve.sh
```

需要 bash、Python3 和 Node.js 等工具。

运行后浏览器打开 `http://localhost:8000`（默认占据此本地端口，用户亦可自行修改 `serve.sh` 和 `server.js` 中的端口号）。

网页提供基于 LocalStorage 的账户注册和登录系统，其账户信息用于排行榜排名。

在网页「基本模式」中可以选择「单字练习」、「文章练习」、「自定义文章」三种模式。

首先用户应加载 Rime 词典，即按照 [RIME 方案](https://rime.im/)上传本地一个 `.dict.yaml` 文件。

在「单字练习」中，单击「开始练习」按钮，则会给出字频从高到低的简体中文汉字，下方根据上传的 `.dict.yaml` 文件给出对应输入字符。

在「文章练习」中，单击「开始练习」按钮，则会从三个短句中抽出一句并进行练习。

在「自定义文章」中，用户还需单击「加载文本文章」，上传一个本地文本文件进行练习。

练习有「暂停/继续」和重置按键，并由正确率、每字速度和每按键速度记录。

当用户已登录，则按下「重置」键，此次练习会进入排行榜排名，排行榜排名以正确率为第一关键字，速度为第二关键字排序。

网页还提供了六种内置样式，可供选择。

## 项目说明

项目结构如下：

```
\serve.sh # shell 启动脚本
\server.js # Node.js 静态文件服务器
\index.html # 网页页面布局
\styles.css # 网页页面样式
\app.js # 网页业务逻辑
\regular_cf.txt # 按字频从高到低排序的简体字表
\charamap.txt # 繁简中文单字转换表
```

本项目使用 `serve.sh` 脚本启动，利用 `server.js` 部署静态文件服务器，`index.html`、`styles.css`、`app.js` 前端三件套提供网页交互。

`regular_cf.txt` 用于单字练习时给出，`charamap.txt` 用于繁简转换。

## 特别感谢

[1] [RIME 方案](https://github.com/rime/home/wiki/RimeWithSchemata#rime-輸入方案)，作为本项目最大的灵感来源和依赖。

[2] [berniey 的 hanziconv](https://github.com/berniey/hanziconv/tree/master) 项目，提供繁简转换表。

[3] [forfudan 的 chinese-characters-frequency](https://github.com/forfudan/chinese-characters-frequency) 项目，提供字频表。

---

许可证声明

This module is distributed under Apache License, Version 2.0.



