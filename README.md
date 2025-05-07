# Rails of 1914 - 回合制铁路策略游戏

这是一个基于第一次世界大战背景的回合制策略游戏，玩家需要通过城市建设、铁路建设和军队运输来在冲突地区取得胜利。

## 游戏特点

- 六角格沙盘地图系统
- 回合制策略玩法
- 城市建设与升级
- 铁路网络建设
- 军队动员与运输
- 经济与资源管理

## 技术栈

- Python 3.8+
- Flask
- HTML5 / CSS3 / JavaScript
- SVG/Canvas用于六角格地图渲染

## 如何开始

### 安装

1. 克隆仓库
```bash
git clone https://github.com/yourusername/rails-of-1914.git
cd rails-of-1914
```

2. 创建虚拟环境（推荐）
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac/Linux
python -m venv venv
source venv/bin/activate
```

3. 安装依赖
```bash
pip install -r requirements.txt
```

### 运行游戏

1. 启动Flask服务器
```bash
python app.py
```

2. 在浏览器中访问 `http://localhost:5000` 开始游戏

### 开发

如果你想参与开发，可以按照以下目录结构了解项目：

```
rails-of-1914/
├── app.py             # Flask应用入口
├── routes.py          # API路由
├── game/              # 游戏核心逻辑
│   ├── __init__.py    
│   ├── models.py      # 游戏模型（城市、铁路等）
│   ├── controller.py  # 游戏控制器
│   └── map_generator.py # 地图生成器
├── static/            # 静态资源
│   ├── css/           # 样式表
│   ├── js/            # JavaScript
│   └── images/        # 图片资源
├── templates/         # HTML模板
│   ├── index.html     # 首页
│   └── game.html      # 游戏界面
└── docs/              # 文档
    └── game_guide.md  # 游戏指南
```

## 部署

游戏可以部署到任何支持Python的Web服务器上，推荐使用以下平台：

- Heroku
- Render
- Vercel (需要添加Vercel适配)
- 任何支持Python的VPS或服务器

### 在Heroku上部署

1. 安装Heroku CLI
2. 登录Heroku
```bash
heroku login
```

3. 创建Heroku应用
```bash
heroku create rails-of-1914
```

4. 部署应用
```bash
git push heroku master
```

## 游戏指南

详细的游戏玩法说明请参阅游戏内教程或`docs/game_guide.md`文件。

## 贡献

欢迎贡献代码、报告问题或提出改进建议！

## 许可证

MIT许可证 