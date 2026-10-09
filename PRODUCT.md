# 本地绘图工作台
<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
当前用户在自己的 Windows 电脑上进行本地多模型绘图和批量生成。

## Product Purpose
输入多行提示词，配置每条抽奖数量，通过 ComfyUI 执行队列并查看、筛选和导出图片。

## Operating Context
RTX 5070 Ti 16GB；浏览器工作台 8000，ComfyUI 8190。日常语言为中文，支持英文界面。

## Capabilities and Constraints
四个已安装工作流：Z-Image-Turbo、SDXL Turbo、Qwen-Image 2.1 INT8、FLUX.2 klein 4B FP8。
切换模型更新等待任务，正在生成和已完成的任务不变。模型具有各自默认尺寸、步数、CFG。
支持比例、种子、提示词前后缀、提示词历史、每条 1–100 张、每批最多 1000 张。
队列可暂停、恢复、停止当前、清空和打乱；清空任务不删除已生成图片。
图片详情含真实模型、种子、尺寸、步数、耗时；支持评分、过滤、重新生成、下载和本地目录。
原型设计不得写入真实队列或更换现有上线界面。

## Brand Commitments
名称为“本地绘图工作台”，不以某个模型命名。本次用户要求三份 HTML 布局原型，再选择正式方向。

## Evidence on Hand
现有 static/index.html、backend、workflows/registry.json；output 下有实际模型测试图。

## Product Principles
模型和图片归属可辨认；等待与生成中任务有明确边界；保存图片优先；批量操作明确反馈。
