"""
游戏API路由
"""

from flask import Blueprint, jsonify, request
from game.controller import GameController

# 创建蓝图
api = Blueprint('api', __name__, url_prefix='/api')

# 获取游戏控制器
game_controller = GameController.get_instance()

@api.route('/game-state', methods=['GET'])
def get_game_state():
    """获取游戏当前状态"""
    return jsonify(game_controller.get_game_state())

@api.route('/next-round', methods=['POST'])
def next_round():
    """进入下一回合"""
    result = game_controller.next_round()
    return jsonify({
        "success": result,
        "game_state": game_controller.get_game_state()
    })

@api.route('/build-town', methods=['POST'])
def build_town():
    """建造城镇"""
    data = request.get_json()
    
    region_id = data.get('region_id')
    hex_coords = tuple(data.get('hex_coords', [0, 0, 0]))
    town_name = data.get('town_name', '新城镇')
    player = data.get('player')
    
    if not all([region_id, hex_coords, town_name, player]):
        return jsonify({"success": False, "message": "参数不完整"}), 400
    
    result = game_controller.build_town(region_id, hex_coords, town_name, player)
    
    return jsonify({
        "success": result,
        "game_state": game_controller.get_game_state()
    })

@api.route('/build-railway', methods=['POST'])
def build_railway():
    """建造铁路"""
    data = request.get_json()
    
    region_id = data.get('region_id')
    start_coords = tuple(data.get('start_coords', [0, 0, 0]))
    end_coords = tuple(data.get('end_coords', [0, 0, 0]))
    player = data.get('player')
    
    if not all([region_id, start_coords, end_coords, player]):
        return jsonify({"success": False, "message": "参数不完整"}), 400
    
    result = game_controller.build_railway(region_id, start_coords, end_coords, player)
    
    return jsonify({
        "success": result,
        "game_state": game_controller.get_game_state()
    })

@api.route('/mobilize-troops', methods=['POST'])
def mobilize_troops():
    """动员军队"""
    data = request.get_json()
    
    region_id = data.get('region_id')
    town_name = data.get('town_name')
    amount = data.get('amount', 0)
    player = data.get('player')
    
    if not all([region_id, town_name, player]) or amount <= 0:
        return jsonify({"success": False, "message": "参数不完整或无效"}), 400
    
    result = game_controller.mobilize_troops(region_id, town_name, amount, player)
    
    return jsonify({
        "success": result > 0,
        "mobilized": result,
        "game_state": game_controller.get_game_state()
    })

@api.route('/declare-war', methods=['POST'])
def declare_war():
    """宣战"""
    data = request.get_json()
    
    player = data.get('player')
    
    if not player:
        return jsonify({"success": False, "message": "缺少玩家信息"}), 400
    
    # 使用玩家阵营直接宣战，不再需要指定区域
    result = game_controller.declare_war(player)
    
    return jsonify({
        "success": result,
        "game_state": game_controller.get_game_state()
    })

@api.route('/reset-game', methods=['POST'])
def reset_game():
    """重置游戏"""
    game_controller.reset_game()
    return jsonify({
        "success": True,
        "game_state": game_controller.get_game_state()
    }) 