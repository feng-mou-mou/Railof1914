from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_cors import CORS
from game.controller import GameController
import os
import json

app = Flask(__name__)
CORS(app)

# 游戏状态文件路径
GAME_STATE_FILE = 'game_state.json'

# 加载游戏状态
def load_game_state():
    try:
        if os.path.exists(GAME_STATE_FILE):
            with open(GAME_STATE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            # 如果文件不存在，初始化游戏状态
            return init_game_state()
    except Exception as e:
        print(f"加载游戏状态失败: {str(e)}")
        return init_game_state()

# 保存游戏状态
def save_game_state(game_state):
    try:
        with open(GAME_STATE_FILE, 'w', encoding='utf-8') as f:
            json.dump(game_state, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"保存游戏状态失败: {str(e)}")
        return False

# 初始化游戏状态
def init_game_state():
    """初始化一个新的游戏状态"""
    try:
        # 创建基本游戏状态结构
        game_state = {
            "round": 1,
            "phase": "保护期",
            "current_player": "德军",
            "war_declared": False,
            "war_countdown": 0,
            "regions": [],
            "players": {
                "德军": {
                    "gdp": 200,
                    "population": 0
                },
                "协约国": {
                    "gdp": 200,
                    "population": 0
                }
            },
            # 定义势力划分
            "factions": {
                "德军": ["德国", "比利时"],  # 德意志帝国包括德国和比利时
                "协约国": ["法国"]           # 协约国包括法国
            },
            # 定义冲突地区
            "conflict_regions": {
                "德军": "GE-3",    # 德意志帝国冲突地区
                "协约国": "FR-3"   # 协约国冲突地区
            }
        }
        
        # 使用游戏控制器获取新的地图数据
        controller = GameController.get_instance()
        controller.reset_game()  # 重置游戏状态
        
        # 转换成JSON兼容格式
        regions_data = []
        for region_id, region in controller.game_state.regions.items():
            # 区域基本信息
            region_data = {
                "id": region.id,
                "name": region.name,
                "towns": [],
                "railways": [],
                "hex_tiles": []
            }
            
            # 添加区域内的六边形格子
            for hex_tile in region.hex_tiles:
                region_data["hex_tiles"].append({
                    "q": hex_tile.q,
                    "r": hex_tile.r,
                    "s": hex_tile.s
                })
            
            # 添加区域到游戏状态
            regions_data.append(region_data)
        
        game_state["regions"] = regions_data
        
        print("游戏状态初始化成功")
        return game_state
        
    except Exception as e:
        print(f"初始化游戏状态失败: {str(e)}")
        # 返回最小游戏状态
        return {
            "round": 1,
            "phase": "保护期",
            "current_player": "德军",
            "war_declared": False,
            "war_countdown": 0,
            "regions": [],
            "players": {
                "德军": {"gdp": 200, "population": 0},
                "协约国": {"gdp": 200, "population": 0}
            }
        }

@app.route('/')
def index():
    """渲染游戏主页"""
    return render_template('index.html')

@app.route('/history')
def history():
    """渲染历史背景页面"""
    return render_template('history.html')

@app.route('/custom-game')
def custom_game():
    """渲染自定义游戏页面"""
    return render_template('custom_game.html')

@app.route('/choose-faction')
def choose_faction():
    """渲染选择势力页面"""
    return render_template('choose_faction.html')

@app.route('/game')
def game():
    """渲染游戏画面"""
    # 获取选择的派系参数
    faction = request.args.get('faction')
    
    # 如果没有选择派系，重定向到选择势力页面
    if not faction:
        return redirect(url_for('choose_faction'))
    
    # 获取游戏控制器实例
    controller = GameController.get_instance()
    
    # 设置当前玩家
    if faction == 'entente':
        current_player = "协约国"
    else:
        current_player = "德军"
    
    # 重置游戏状态并设置当前玩家
    controller.reset_game()
    controller.game_state.current_player = current_player
    
    # 保存初始游戏状态
    game_state = controller.get_game_state()
    save_game_state(game_state)
    
    return render_template('game.html')

@app.route('/api/game-state', methods=['GET'])
def get_game_state():
    try:
        # 使用GameController中的状态
        controller = GameController.get_instance()
        game_state = controller.get_game_state()
        return jsonify(game_state)
    except Exception as e:
        print(f"获取游戏状态失败: {str(e)}")
        return jsonify({"error": "获取游戏状态失败"}), 500

@app.route('/api/map-data', methods=['GET'])
def get_map_data():
    """专门为地图显示提供区域坐标的API"""
    try:
        # 直接从GameController获取游戏状态
        controller = GameController.get_instance()
        game_state = controller.get_game_state()
        
        # 提取地图数据 - 包含区域和六边形坐标
        map_data = {
            "regions": []
        }
        
        for region in game_state.get("regions", []):
            map_region = {
                "id": region.get("id", ""),
                "name": region.get("name", ""),
                "hex_tiles": region.get("hex_tiles", []),
                "faction": "协约国" if region["id"].startswith("FR") else "德军"  # 添加阵营信息
            }
            map_data["regions"].append(map_region)
        
        return jsonify(map_data)
    except Exception as e:
        print(f"获取地图数据失败: {str(e)}")
        return jsonify({"error": "获取地图数据失败"}), 500

@app.route('/api/next-round', methods=['POST'])
def next_round():
    try:
        data = request.get_json()
        current_faction = data.get('player')
        
        if not current_faction:
            return jsonify({
                "success": False,
                "message": "缺少玩家阵营信息"
            }), 400
        
        # 获取游戏控制器实例
        controller = GameController.get_instance()
        
        # 进入下一回合，但保持当前玩家不变
        result = controller.next_round(current_faction)
        
        # 获取最新游戏状态
        game_state = controller.get_game_state()
        
        # 确保当前玩家不变
        game_state['current_player'] = current_faction
        
        # 保存游戏状态到文件
        save_game_state(game_state)
        
        return jsonify({
            "success": True,
            "result": result,
            "game_state": game_state
        })
    except Exception as e:
        print(f"进入下一回合失败: {str(e)}")
        return jsonify({"error": "进入下一回合失败"}), 500

@app.route('/api/reset-game', methods=['POST'])
def reset_game():
    try:
        # 获取游戏控制器实例
        controller = GameController.get_instance()
        
        # 获取请求数据，如果没有数据则使用空字典
        data = request.get_json(silent=True) or {}
        
        # 重置游戏状态
        controller.reset_game()
        
        # 更新当前玩家（如果请求中有指定）
        if 'faction' in data:
            if data['faction'] == 'entente':
                controller.game_state.current_player = "协约国"
            else:
                controller.game_state.current_player = "德军"
        
        # 获取最新游戏状态
        game_state = controller.get_game_state()
        
        # 保存到文件
        save_game_state(game_state)
        
        print("游戏重置成功")
        return jsonify({
            "success": True,
            "game_state": game_state
        })
    except Exception as e:
        print(f"重置游戏失败: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/build-town', methods=['POST'])
def build_town():
    try:
        print("收到建造城镇请求:", request.json)
        data = request.json
        
        # 检查是否提供了必要的参数
        if not all(key in data for key in ['region_id', 'q', 'r', 's', 'town_name', 'player']):
            print("参数不完整:", data)
            return jsonify({
                'success': False,
                'message': '参数不完整'
            }), 400
        
        # 获取游戏控制器实例
        controller = GameController.get_instance()
        
        # 建造城镇
        success = controller.build_town(
            data['region_id'],
            (data['q'], data['r'], data['s']),
            data['town_name'],
            data['player']
        )
        
        if not success:
            return jsonify({
                'success': False,
                'message': '建造城镇失败'
            }), 400
        
        # 获取最新游戏状态
        game_state = controller.get_game_state()
        
        print(f"成功建造城镇 {data['town_name']} 在坐标 ({data['q']},{data['r']},{data['s']})")
        return jsonify({
            'success': True,
            'game_state': game_state
        })
        
    except Exception as e:
        print(f"建造城镇时发生错误: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'发生错误: {str(e)}'
        }), 500

def are_hexes_adjacent(start_q, start_r, end_q, end_r):
    """检查两个六边形是否相邻"""
    # 获取起点的所有相邻坐标
    neighbors = []
    if start_q % 2 == 0:  # 偶数列
        neighbors = [
            (start_q, start_r-1),     # 上
            (start_q, start_r+1),     # 下
            (start_q-1, start_r),     # 左上
            (start_q+1, start_r),     # 右上
            (start_q-1, start_r+1),   # 左下
            (start_q+1, start_r+1)    # 右下
        ]
    else:  # 奇数列
        neighbors = [
            (start_q, start_r-1),     # 上
            (start_q, start_r+1),     # 下
            (start_q-1, start_r-1),   # 左上
            (start_q+1, start_r-1),   # 右上
            (start_q-1, start_r),     # 左下
            (start_q+1, start_r)      # 右下
        ]
    
    # 检查终点是否在相邻坐标列表中
    return (end_q, end_r) in neighbors

@app.route('/api/build-railway', methods=['POST'])
def build_railway():
    """建设铁路"""
    try:
        data = request.get_json()
        
        # 检查参数完整性
        required_params = ['region_id', 'start_q', 'start_r', 'start_s', 'end_q', 'end_r', 'end_s', 'player']
        if not all(key in data for key in required_params):
            print("缺少参数:", [key for key in required_params if key not in data])
            return jsonify({
                'success': False,
                'message': '参数不完整'
            }), 400
        
        print(f"开始建造铁路: 从({data['start_q']},{data['start_r']},{data['start_s']})到({data['end_q']},{data['end_r']},{data['end_s']}), 区域: {data['region_id']}, 玩家: {data['player']}")
        
        # 获取游戏控制器实例
        controller = GameController.get_instance()
        
        # 建造铁路
        success = controller.build_railway(
            data['region_id'],
            (data['start_q'], data['start_r'], data['start_s']),
            (data['end_q'], data['end_r'], data['end_s']),
            data['player']
        )
        
        if not success:
            return jsonify({
                'success': False,
                'message': '建造铁路失败'
            }), 400
        
        # 获取最新游戏状态
        game_state = controller.get_game_state()
        
        print(f"成功建造铁路从({data['start_q']},{data['start_r']},{data['start_s']})到({data['end_q']},{data['end_r']},{data['end_s']})")
        return jsonify({
            'success': True,
            'game_state': game_state
        })
        
    except Exception as e:
        print(f"建造铁路时发生错误: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'发生错误: {str(e)}'
        }), 500

@app.route('/api/mobilize-troops', methods=['POST'])
def mobilize_troops():
    try:
        data = request.json
        controller = GameController.get_instance()
        
        # 检查是否是区域动员
        is_region_mobilization = data.get('is_region_mobilization', False)
        
        result = controller.mobilize_troops(
            data.get('region_id'),
            data.get('town_name'),
            data.get('amount'),
            data.get('player'),
            is_region_mobilization
        )
        
        # 区域动员和单个城镇动员返回不同的结果格式
        if is_region_mobilization:
            # 如果区域动员失败
            if not result.get('success', False):
                return jsonify({
                    "success": False,
                    "message": result.get('message', '动员失败'),
                    "game_state": controller.get_game_state()
                })
            
            # 区域动员成功
            return jsonify({
                "success": True,
                "amount": result.get('total_mobilized', 0),
                "details": result.get('details', []),
                "game_state": controller.get_game_state()
            })
        else:
            # 单个城镇动员
            return jsonify({
                "success": result > 0,
                "amount": result,
                "game_state": controller.get_game_state()
            })
    except Exception as e:
        print(f"动员军队失败: {str(e)}")
        return jsonify({"error": "动员军队失败", "message": str(e)}), 500

@app.route('/api/declare-war', methods=['POST'])
def declare_war():
    """宣战"""
    try:
        data = request.get_json()
        player = data.get('player')
        
        if not player:
            return jsonify({"error": "缺少玩家信息"}), 400
            
        controller = GameController.get_instance()
        success = controller.declare_war(player)
        
        if success:
            game_state = controller.get_game_state()
            save_game_state(game_state)
            return jsonify({"success": True, "message": "宣战成功"})
        else:
            return jsonify({"error": "宣战失败"}), 400
            
    except Exception as e:
        print(f"宣战失败: {str(e)}")
        return jsonify({"error": "宣战失败"}), 500

@app.route('/api/upgrade-town', methods=['POST'])
def upgrade_town():
    """升级城镇"""
    try:
        data = request.get_json()
        region_id = data.get('region_id')
        town1_q = data.get('town1_q')
        town1_r = data.get('town1_r')
        town1_s = data.get('town1_s')
        town2_q = data.get('town2_q')
        town2_r = data.get('town2_r')
        town2_s = data.get('town2_s')
        player = data.get('player')
        upgrade_type = data.get('upgrade_type')
        
        # 检查必要参数
        if not all([region_id, 
                   town1_q is not None, town1_r is not None, town1_s is not None, 
                   town2_q is not None, town2_r is not None, town2_s is not None, 
                   player, upgrade_type]):
            return jsonify({"error": "缺少必要参数"}), 400
            
        # 获取游戏控制器
        controller = GameController.get_instance()
        
        # 创建坐标对象
        town1_coords = (town1_q, town1_r, town1_s)
        town2_coords = (town2_q, town2_r, town2_s)
        
        # 尝试升级城镇（修改为使用两个城镇坐标）
        success = controller.upgrade_town(region_id, town1_coords, town2_coords, player, upgrade_type)
        
        if success:
            # 获取并保存更新后的游戏状态
            game_state = controller.get_game_state()
            save_game_state(game_state)
            return jsonify({
                "success": True,
                "message": "城镇升级成功",
                "game_state": game_state
            })
        else:
            return jsonify({"error": "城镇升级失败"}), 400
            
    except Exception as e:
        print(f"升级城镇失败: {str(e)}")
        return jsonify({"error": "升级城镇失败"}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0') 