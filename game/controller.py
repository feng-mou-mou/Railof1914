"""
游戏控制器
负责游戏核心逻辑和流程控制
"""

from .models import GameState, Town, Railway, Army
from .map_generator import create_demo_game_map

class GameController:
    """游戏控制器"""
    
    _instance = None
    
    @classmethod
    def get_instance(cls):
        """获取游戏控制器单例"""
        if cls._instance is None:
            cls._instance = GameController()
        return cls._instance
    
    def __init__(self):
        """初始化游戏控制器"""
        self.game_state = None
        self.reset_game()
        
    def reset_game(self):
        """重置游戏状态"""
        self.game_state = GameState()
        
        # 初始化地图
        regions = create_demo_game_map()
        for region in regions.values():
            self.game_state.add_region(region)
            
        # 初始化玩家资源：只在游戏开始时给予初始GDP 200
        self.player_resources = {
            "德军": {"gdp": 200, "population": 0},
            "协约国": {"gdp": 200, "population": 0}
        }
    
    def get_game_state(self):
        """获取当前游戏状态"""
        state_dict = {
            "round": self.game_state.round,
            "phase": self.game_state.phase,
            "current_player": self.game_state.current_player,
            "war_declared": self.game_state.war_declared,
            "war_countdown": self.game_state.war_countdown,
            "regions": [],
            "players": {
                player: {
                    "gdp": self.player_resources[player]["gdp"],
                    "population": self.player_resources[player]["population"]
                }
                for player in self.game_state.players
            },
            # 添加势力划分信息
            "factions": self.game_state.factions,
            # 添加冲突地区信息
            "conflict_regions": self.game_state.conflict_regions,
            # 添加游戏结束相关信息
            "game_ended": self.game_state.game_ended,
            "winner": self.game_state.winner,
            "final_forces": self.game_state.final_forces,
            # 添加已到达冲突区域的兵力信息
            "arrived_forces": self.game_state.arrived_forces,
            # 添加军队信息
            "armies": []
        }
        
        # 添加军队信息
        for army in self.game_state.armies:
            if not army.current_position:
                continue
                
            army_dict = {
                "owner": army.owner,
                "amount": army.amount,
                "status": army.status,
                "source_town_name": army.source_town_name,
                "current_position": {
                    "q": army.current_position.q,
                    "r": army.current_position.r,
                    "s": army.current_position.s
                },
                "target_region_id": army.target_region_id
            }
            state_dict["armies"].append(army_dict)
        
        # 添加区域信息
        for region in self.game_state.regions.values():
            region_dict = {
                "id": region.id,
                "name": region.name,
                "towns": [],
                "railways": [],
                "hex_tiles": []  # 添加格子信息
            }
            
            # 添加六边形格子信息
            for hex_tile in region.hex_tiles:
                hex_dict = {
                    "q": hex_tile.q,
                    "r": hex_tile.r,
                    "s": hex_tile.s
                }
                region_dict["hex_tiles"].append(hex_dict)
            
            # 添加城镇信息
            for town in region.towns:
                # 寻找城镇所在的格子
                hex_coords = None
                for hex_tile in region.hex_tiles:
                    if hex_tile.town == town:
                        hex_coords = {"q": hex_tile.q, "r": hex_tile.r, "s": hex_tile.s}
                        break
                
                town_dict = {
                    "name": town.name,
                    "level": town.level,
                    "owner": town.owner,
                    "population": town.population,
                    "mobilized": town.mobilized,
                    "gdp": town.get_gdp(),
                    "coords": hex_coords,  # 添加城镇坐标
                    "is_under_construction": town.is_under_construction  # 添加建设状态
                }
                region_dict["towns"].append(town_dict)
            
            # 添加铁路信息
            for railway in region.railways:
                railway_dict = {
                    "level": railway.level,
                    "capacity": railway.get_capacity(),
                    "troops": railway.troops,
                    "start": {"q": railway.start_hex.q, "r": railway.start_hex.r, "s": railway.start_hex.s},
                    "end": {"q": railway.end_hex.q, "r": railway.end_hex.r, "s": railway.end_hex.s},
                    "is_under_construction": railway.is_under_construction  # 添加建设状态
                }
                region_dict["railways"].append(railway_dict)
            
            state_dict["regions"].append(region_dict)
        
        return state_dict
    
    def next_round(self, current_faction):
        """进入下一回合
        
        Args:
            current_faction (str): 当前玩家阵营，确保不会切换
        """
        # 先计算资源（建设中的单位不会产生GDP）
        self._calculate_resources()
        
        # 然后完成建设（这些单位要到下一回合才会产生GDP）
        for region in self.game_state.regions.values():
            # 完成城镇建设
            for town in region.towns:
                if town.is_under_construction:
                    town.complete_construction()
            
            # 完成铁路建设
            for railway in region.railways:
                if railway.is_under_construction:
                    railway.complete_construction()
        
        # 进入下一回合，但保持当前玩家不变
        self.game_state.round += 1
        self.game_state.phase = self.game_state.get_phase()
        self.game_state.current_player = current_faction
        
        # 更新军队状态和位置
        self._update_armies()
        
        # 战争倒计时
        if self.game_state.war_declared:
            self.game_state.war_countdown -= 1
            if self.game_state.war_countdown <= 0:
                self._resolve_conflict()
                
        # 只检查是否超过总回合数
        return self.game_state.round <= self.game_state.max_rounds
    
    def _calculate_resources(self):
        """计算玩家资源"""
        for player in self.game_state.players:
            # 计算当前回合的GDP产出
            round_gdp = 0
            
            # 按区域计算GDP
            for region in self.game_state.regions.values():
                # 只计算该玩家在此区域的城镇GDP
                region_gdp = 0
                player_towns = [town for town in region.towns if town.owner == player]
                if player_towns:
                    # 计算该玩家在此区域的基础GDP
                    base_gdp = sum(town.get_gdp() for town in player_towns)
                    
                    # 如果区域内该玩家的所有城镇都互联，加成20%
                    if len(player_towns) > 1:
                        # 检查所有城镇是否互联
                        all_connected = True
                        for i in range(len(player_towns)):
                            for j in range(i + 1, len(player_towns)):
                                if not region.are_towns_connected(player_towns[i], player_towns[j]):
                                    all_connected = False
                                    break
                            if not all_connected:
                                break
                        
                        if all_connected:
                            region_gdp = base_gdp * 1.2
                        else:
                            region_gdp = base_gdp
                    else:
                        region_gdp = base_gdp
                        
                round_gdp += region_gdp
            
            # 更新玩家资源：保留上回合剩余GDP，加上本回合产出
            self.player_resources[player]["gdp"] += round_gdp
            
            # 更新人口：将所有城镇的人口加到玩家总人口中
            total_population = 0
            for region in self.game_state.regions.values():
                for town in region.towns:
                    if town.owner == player and not town.is_under_construction:
                        total_population += town.population
            
            self.player_resources[player]["population"] = total_population
    
    def build_town(self, region_id, hex_coords, town_name, player):
        """建造城镇
        
        Args:
            region_id (str): 区域ID
            hex_coords (tuple): 六边形格子坐标 (q,r,s)
            town_name (str): 城镇名称
            player (str): 玩家阵营
            
        Returns:
            bool: 是否成功建造
        """
        # 检查是否有足够资源
        if self.player_resources[player]["gdp"] < Town.TOWN_CONFIG[Town.VILLAGE]["cost"]:
            return False
        
        region = self.game_state.regions.get(region_id)
        if not region:
            return False
        
        # 找到对应的格子
        hex_tile = None
        for tile in region.hex_tiles:
            if (tile.q, tile.r, tile.s) == hex_coords:
                hex_tile = tile
                break
        
        if not hex_tile or hex_tile.town:
            return False
        
        # 创建新城镇
        town = Town(town_name, Town.VILLAGE, player)
        
        # 尝试添加到区域
        if region.add_town(town, hex_tile):
            # 扣除资源
            self.player_resources[player]["gdp"] -= Town.TOWN_CONFIG[Town.VILLAGE]["cost"]
            # 增加人口资源
            self.player_resources[player]["population"] += town.population
            return True
        
        return False
    
    def build_railway(self, region_id, start_coords, end_coords, player):
        """建造铁路
        
        Args:
            region_id (str): 区域ID（起点所在区域）
            start_coords (tuple): 起始格子坐标 (q,r,s)
            end_coords (tuple): 终止格子坐标 (q,r,s)
            player (str): 玩家阵营
            
        Returns:
            bool: 是否成功建造
        """
        # 检查是否有足够资源
        if self.player_resources[player]["gdp"] < Railway.RAILWAY_CONFIG[Railway.LEVEL_1]["cost"]:
            print(f"GDP不足，需要{Railway.RAILWAY_CONFIG[Railway.LEVEL_1]['cost']}，当前{self.player_resources[player]['gdp']}")
            return False
        
        # 找到对应的格子（可能在不同区域）
        start_hex = None
        end_hex = None
        start_region = None
        end_region = None
        
        # 遍历所有区域寻找起点和终点格子
        for region_id, region in self.game_state.regions.items():
            for tile in region.hex_tiles:
                if (tile.q, tile.r, tile.s) == start_coords:
                    start_hex = tile
                    start_region = region
                elif (tile.q, tile.r, tile.s) == end_coords:
                    end_hex = tile
                    end_region = region
                
                # 如果两个格子都找到了，可以提前结束循环
                if start_hex and end_hex:
                    break
            
            # 如果两个格子都找到了，可以提前结束外层循环
            if start_hex and end_hex:
                break
        
        if not start_hex:
            print(f"找不到起点格子: {start_coords}")
            return False
            
        if not end_hex:
            print(f"找不到终点格子: {end_coords}")
            return False
        
        # 使用二维奇偶性检查相邻
        if not start_hex.is_adjacent(end_hex):
            print(f"格子不相邻: 起点=({start_hex.q},{start_hex.r})，终点=({end_hex.q},{end_hex.r})")
            return False
        
        # 创建新铁路
        try:
            railway = Railway(start_hex, end_hex)
            
            # 添加到起点所在区域
            start_region.add_railway(railway)
            
            # 输出跨区域信息
            if start_region.id != end_region.id:
                print(f"成功建造跨区域铁路：从{start_region.id}区域到{end_region.id}区域")
            
            # 扣除资源
            self.player_resources[player]["gdp"] -= Railway.RAILWAY_CONFIG[Railway.LEVEL_1]["cost"]
            
            print(f"成功建造铁路: 从({start_hex.q},{start_hex.r})到({end_hex.q},{end_hex.r})")
            return True
        except Exception as e:
            print(f"建造铁路失败: {str(e)}")
            return False
    
    def mobilize_troops(self, region_id, town_name=None, amount=None, player=None, is_region_mobilization=False):
        """动员军队
        
        Args:
            region_id (str): 区域ID
            town_name (str, optional): 城镇名称，如果是区域动员则为None
            amount (int, optional): 动员数量，如果是区域动员则为None
            player (str): 玩家阵营
            is_region_mobilization (bool): 是否是区域动员，默认为False
            
        Returns:
            int or dict: 实际动员数量，或者区域动员情况的字典
        """
        region = self.game_state.regions.get(region_id)
        if not region:
            return 0 if not is_region_mobilization else {"success": False, "message": "找不到指定区域"}
        
        # 区域动员
        if is_region_mobilization:
            # 获取该区域内所有不在建设中的玩家拥有的城镇
            player_towns = [t for t in region.towns if t.owner == player and not t.is_under_construction]
            
            if not player_towns:
                return {"success": False, "message": "该区域没有您的城镇或所有城镇都在建设中"}
            
            total_mobilized = 0
            mobilization_details = []
            
            # 对每个城镇进行动员
            for town in player_towns:
                # 根据城镇等级确定动员率
                mobilization_rate = 0
                if town.level == Town.VILLAGE:
                    mobilization_rate = 0.5  # 村落动员率50%
                elif town.level == Town.SMALL_CITY:
                    mobilization_rate = 0.4  # 小城市动员率40%
                elif town.level == Town.LARGE_CITY:
                    mobilization_rate = 0.3  # 大城市动员率30%
                
                # 计算最大可动员数量
                max_mobilization = int(town.population * mobilization_rate)
                available_pop = max(0, max_mobilization - town.mobilized)
                
                if available_pop > 0:
                    # 执行动员
                    town.mobilized += available_pop
                    self.player_resources[player]["population"] -= available_pop
                    total_mobilized += available_pop
                    
                    # 创建军队单位
                    army = Army(town, available_pop, player)
                    # 设置目标区域为冲突区域
                    army.target_region_id = self.game_state.conflict_regions.get(player)
                    # 设置创建回合
                    army.generation_time = self.game_state.round
                    
                    # 找到城镇所在的格子
                    for hex_tile in region.hex_tiles:
                        if hex_tile.town == town:
                            army.current_position = hex_tile
                            break
                    
                    # 添加到游戏状态
                    self.game_state.armies.append(army)
                    
                    # 记录动员详情
                    mobilization_details.append({
                        "town_name": town.name,
                        "mobilized": available_pop
                    })
            
            return {
                "success": True,
                "total_mobilized": total_mobilized,
                "details": mobilization_details
            }
        
        # 单个城镇动员（原有功能）
        else:
            # 找到对应的城镇
            town = None
            for t in region.towns:
                if t.name == town_name and t.owner == player:
                    town = t
                    break
            
            if not town:
                return 0
            
            # 检查是否有足够人口
            available_pop = min(
                self.player_resources[player]["population"],
                town.get_max_mobilization() - town.mobilized
            )
            
            actual_amount = min(amount, available_pop)
            
            # 执行动员
            town.mobilized += actual_amount
            self.player_resources[player]["population"] -= actual_amount
            
            # 创建军队单位
            if actual_amount > 0:
                army = Army(town, actual_amount, player)
                # 设置目标区域为冲突区域
                army.target_region_id = self.game_state.conflict_regions.get(player)
                # 设置创建回合
                army.generation_time = self.game_state.round
                
                # 找到城镇所在的格子
                for hex_tile in region.hex_tiles:
                    if hex_tile.town == town:
                        army.current_position = hex_tile
                        break
                
                # 添加到游戏状态
                self.game_state.armies.append(army)
            
            return actual_amount
    
    def declare_war(self, player):
        """宣战
        
        Args:
            player (str): 宣战的玩家阵营
            
        Returns:
            bool: 是否宣战成功
        """
        if self.game_state.phase != GameState.TENSION_PHASE or self.game_state.war_declared:
            return False
            
        # 使用新的宣战机制
        return self.game_state.declare_war(player)
    
    def upgrade_town(self, region_id, town1_coords, town2_coords, player, upgrade_type):
        """升级城镇（合并两个城镇）
        
        Args:
            region_id (str): 区域ID
            town1_coords (tuple): 第一个城镇坐标 (q,r,s)
            town2_coords (tuple): 第二个城镇坐标 (q,r,s)
            player (str): 玩家阵营
            upgrade_type (str): 升级类型，'village'或'small_city'
            
        Returns:
            bool: 是否成功升级
        """
        # 获取区域
        region = self.game_state.regions.get(region_id)
        if not region:
            print(f"找不到区域: {region_id}")
            return False
            
        # 查找两个城镇
        town1 = None
        town2 = None
        town1_hex = None
        town2_hex = None
        
        for hex_tile in region.hex_tiles:
            # 查找第一个城镇
            if (hex_tile.q, hex_tile.r, hex_tile.s) == town1_coords and hex_tile.town:
                town1 = hex_tile.town
                town1_hex = hex_tile
            # 查找第二个城镇
            elif (hex_tile.q, hex_tile.r, hex_tile.s) == town2_coords and hex_tile.town:
                town2 = hex_tile.town
                town2_hex = hex_tile
        
        # 检查两个城镇是否存在
        if not town1 or not town2:
            print(f"找不到要合并的城镇")
            return False
        
        # 检查城镇所有权
        if town1.owner != player or town2.owner != player:
            print(f"城镇不属于玩家{player}")
            return False
        
        # 检查城镇是否在建设中
        if town1.is_under_construction or town2.is_under_construction:
            print(f"城镇正在建设中，无法合并")
            return False
            
        # 检查城镇是否已动员兵力（已动员的区域不能建设）
        if town1.mobilized > 0 or town2.mobilized > 0:
            print(f"已动员兵力的城镇不能进行建设")
            return False
        
        # 检查城镇等级是否符合升级类型
        if upgrade_type == 'village' and (town1.level != 'village' or town2.level != 'village'):
            print(f"只能合并两个村落升级为小城市")
            return False
        elif upgrade_type == 'small_city' and (town1.level != 'small_city' or town2.level != 'small_city'):
            print(f"只能合并两个小城市升级为大城市")
            return False
        
        # 检查两个城镇是否通过铁路互联
        if not region.are_towns_connected(town1, town2):
            print(f"城镇{town1.name}和{town2.name}必须通过铁路互联才能合并升级")
            return False
        
        # 确定升级成本和新城镇等级
        if upgrade_type == 'village':
            upgrade_cost = 150
            next_level = 'small_city'
        else:  # small_city
            upgrade_cost = 400
            next_level = 'large_city'
        
        # 检查玩家资源是否足够
        if self.player_resources[player]["gdp"] < upgrade_cost:
            print(f"GDP不足，需要{upgrade_cost}，当前{self.player_resources[player]['gdp']}")
            return False
        
        # 检查区域容量限制
        town_counts = {
            'small_city': sum(1 for t in region.towns if t.level == 'small_city'),
            'large_city': sum(1 for t in region.towns if t.level == 'large_city')
        }
        
        if next_level == 'small_city' and town_counts['small_city'] >= 2:
            print(f"区域{region.name}已达到小城市数量上限(2)")
            return False
        elif next_level == 'large_city' and town_counts['large_city'] >= 1:
            print(f"区域{region.name}已达到大城市数量上限(1)")
            return False
        
        # 扣除资源
        self.player_resources[player]["gdp"] -= upgrade_cost
        
        # 创建新城镇名称（拼接两个城镇的名称）
        new_town_name = f"{town1.name} - {town2.name}"
        
        # 创建一个新城镇实例
        new_town = Town(new_town_name, next_level, player)
        
        # 合并两个城镇的人口
        new_town.population = town1.population + town2.population
        
        # 新城镇处于建设状态
        new_town.is_under_construction = True
        
        # 从区域中移除原有城镇
        region.towns.remove(town1)
        region.towns.remove(town2)
        
        # 将新城镇添加到区域
        region.towns.append(new_town)
        
        # 更新所有相关格子，它们现在都指向同一个城镇实例
        town1_hex.town = new_town
        town2_hex.town = new_town
        
        print(f"成功将城镇{town1.name}和{town2.name}合并升级为{next_level}，新名称为{new_town_name}")
        return True
    
    def _resolve_conflict(self):
        """解决冲突，确定胜利者并更新游戏状态
        
        Returns:
            dict: 包含胜利结果的字典
        """
        # 使用游戏状态的方法计算胜利者
        winner = self.game_state._resolve_conflict()
        
        if not winner:
            return {"success": False, "message": "无法确定胜利者"}
            
        # 创建胜利信息 - 使用已到达的兵力而不是城镇的动员兵力
        forces = self.game_state.arrived_forces.copy()
        
        # 更新游戏状态，标记游戏已结束
        self.game_state.game_ended = True
        self.game_state.winner = winner
        self.game_state.final_forces = forces
        
        # 创建战争结果信息
        result = {
            "success": True,
            "winner": winner,
            "forces": forces,
            "message": f"{winner}胜利！战争结束！"
        }
        
        print(f"战争结束，{winner}胜利！")
        print(f"冲突区域兵力情况: {forces}")
        
        return result
    
    def _update_armies(self):
        """更新所有军队的状态和位置"""
        print(f"开始更新军队状态和位置，当前军队数量: {len(self.game_state.armies)}")
        
        for army in self.game_state.armies:
            rounds_since_creation = self.game_state.round - army.generation_time
            
            # 根据创建时间更新状态
            if rounds_since_creation == 0:
                # 刚刚动员，保持GENERATING状态
                print(f"{army.owner}的{army.amount}万军队从{army.source_town_name}刚刚动员，状态：{army.status}")
            elif rounds_since_creation == 1:
                # 第二回合，进入装载状态
                army.status = Army.LOADING
                print(f"{army.owner}的{army.amount}万军队从{army.source_town_name}开始装载，状态：{army.status}")
            elif rounds_since_creation >= 2:
                # 第三回合及以后，进入运输状态
                if army.status != Army.ARRIVED:
                    army.status = Army.TRANSPORTING
                    print(f"{army.owner}的{army.amount}万军队从{army.source_town_name}正在运输中，状态：{army.status}")
                    
                    # 如果军队还没有确定路径，尝试查找到冲突区域的路径
                    if not army.path_to_conflict and army.current_position:
                        # 找到当前格子所在的区域
                        current_region = None
                        for region_id, region in self.game_state.regions.items():
                            for hex_tile in region.hex_tiles:
                                if (hex_tile.q == army.current_position.q and 
                                    hex_tile.r == army.current_position.r and 
                                    hex_tile.s == army.current_position.s):
                                    current_region = region
                                    # 更新current_position引用为region中的实际对象
                                    army.current_position = hex_tile
                                    break
                            if current_region:
                                break
                        
                        if current_region:
                            print(f"为{army.owner}的军队查找从{army.current_position.q},{army.current_position.r},{army.current_position.s}到{army.target_region_id}的路径")
                            # 使用当前区域的查找方法（它会查找全局路径）
                            path_info = current_region.find_path_to_conflict(
                                army.current_position, 
                                army.target_region_id
                            )
                            
                            if path_info:
                                # 记录路径和使用的铁路
                                army.path_to_conflict = path_info['path'][1:]  # 排除当前位置
                                print(f"找到到冲突区域的路径，长度:{len(army.path_to_conflict)}格")
                            else:
                                print(f"无法找到从 {army.current_position.q},{army.current_position.r},{army.current_position.s} 到 {army.target_region_id} 的路径")
                        else:
                            print(f"无法找到军队当前位置 {army.current_position.q},{army.current_position.r},{army.current_position.s} 所在的区域")
                    
                    # 如果有路径，尝试移动
                    if army.path_to_conflict:
                        self._move_army(army)
                else:
                    print(f"{army.owner}的{army.amount}万军队已到达冲突区域 {army.target_region_id}，状态：{army.status}")
                        
    def _move_army(self, army):
        """移动军队沿路径前进
        
        Args:
            army (Army): 要移动的军队
        """
        if not army.path_to_conflict:
            print(f"{army.owner}的军队没有路径可走")
            return
        
        # 每回合最多移动5格
        max_moves = 5
        moves_made = 0
        
        print(f"开始移动{army.owner}的{army.amount}万军队，当前位置:({army.current_position.q},{army.current_position.r},{army.current_position.s})")
        print(f"路径长度: {len(army.path_to_conflict)}格，目标区域: {army.target_region_id}")
        
        # 调试打印路径中的前5个格子
        debug_path = army.path_to_conflict[:min(5, len(army.path_to_conflict))]
        print(f"路径前5个格子: {[(hex.q, hex.r, hex.s) for hex in debug_path]}")
        
        while moves_made < max_moves and army.path_to_conflict:
            # 获取下一个目标格子
            next_hex = army.path_to_conflict[0]
            
            print(f"尝试移动到下一个格子:({next_hex.q},{next_hex.r},{next_hex.s})")
            
            # 查找当前格子所在的区域
            current_region = None
            for region_id, region in self.game_state.regions.items():
                # 通过比较坐标而不是直接比较对象
                for hex_tile in region.hex_tiles:
                    if (hex_tile.q == army.current_position.q and 
                        hex_tile.r == army.current_position.r and 
                        hex_tile.s == army.current_position.s):
                        current_region = region
                        # 更新current_position引用为region中的实际对象
                        army.current_position = hex_tile
                        break
                if current_region:
                    break
            
            if not current_region:
                print(f"无法找到军队当前位置({army.current_position.q},{army.current_position.r},{army.current_position.s})所在的区域")
                break
            
            print(f"当前区域: {current_region.id}")
            
            # 查找下一个格子所在的区域
            next_region = None
            next_hex_in_current_region = False
            
            # 首先查找当前区域
            for hex_tile in current_region.hex_tiles:
                if (hex_tile.q == next_hex.q and 
                    hex_tile.r == next_hex.r and 
                    hex_tile.s == next_hex.s):
                    # 更新next_hex引用
                    next_hex = hex_tile
                    army.path_to_conflict[0] = hex_tile
                    next_hex_in_current_region = True
                    next_region = current_region
                    break
            
            # 如果在当前区域没找到，查找其他区域
            if not next_hex_in_current_region:
                for region_id, region in self.game_state.regions.items():
                    if region == current_region:
                        continue
                    
                    for hex_tile in region.hex_tiles:
                        if (hex_tile.q == next_hex.q and 
                            hex_tile.r == next_hex.r and 
                            hex_tile.s == next_hex.s):
                            # 更新next_hex引用
                            next_hex = hex_tile
                            army.path_to_conflict[0] = hex_tile
                            next_region = region
                            print(f"下一个格子在不同区域: {region.id}")
                            break
                    
                    if next_region and next_region != current_region:
                        break
            
            # 如果找不到下一个格子所在的区域，跳过移动
            if not next_region:
                print(f"无法找到下一个格子({next_hex.q},{next_hex.r},{next_hex.s})所在的区域，尝试重新路径查找")
                
                # 尝试重新寻找路径
                if current_region:
                    path_info = current_region.find_path_to_conflict(
                        army.current_position, 
                        army.target_region_id
                    )
                    
                    if path_info and path_info['path']:
                        # 更新路径
                        army.path_to_conflict = path_info['path'][1:]  # 排除当前位置
                        print(f"重新找到路径，长度:{len(army.path_to_conflict)}格")
                        # 继续下一次循环尝试移动
                        continue
                    else:
                        print(f"重新寻路失败，无法找到有效路径")
                
                break
            
            print(f"目标区域: {next_region.id}")
            
            # 在相同区域内移动
            if next_region == current_region:
                railway = current_region.find_railway_between(army.current_position, next_hex)
                
                if not railway:
                    print(f"无法找到连接({army.current_position.q},{army.current_position.r},{army.current_position.s})和({next_hex.q},{next_hex.r},{next_hex.s})的铁路")
                    
                    # 尝试重新寻找路径
                    path_info = current_region.find_path_to_conflict(
                        army.current_position, 
                        army.target_region_id
                    )
                    
                    if path_info and path_info['path']:
                        # 更新路径
                        army.path_to_conflict = path_info['path'][1:]  # 排除当前位置
                        print(f"重新找到路径，长度:{len(army.path_to_conflict)}格")
                        # 继续下一次循环尝试移动
                        continue
                    else:
                        print(f"重新寻路失败，无法找到有效路径")
                        break
                    
                # 检查铁路是否在建设中
                if railway.is_under_construction:
                    print(f"铁路在建设中，无法通过")
                    break
                    
                # 检查铁路运力是否足够
                if railway.troops + army.amount <= railway.get_capacity():
                    print(f"铁路运力充足，移动军队")
                    # 移动到新位置
                    railway.troops += army.amount  # 增加铁路上的兵力
                    army.current_position = next_hex
                    army.path_to_conflict.pop(0)  # 移除已经到达的格子
                    
                    moves_made += 1
                    
                    # 检查是否已到达目标区域
                    if next_region.id == army.target_region_id:
                        # 到达冲突区域
                        if not hasattr(self.game_state, 'arrived_forces'):
                            self.game_state.arrived_forces = {}
                        
                        if army.owner not in self.game_state.arrived_forces:
                            self.game_state.arrived_forces[army.owner] = 0
                        self.game_state.arrived_forces[army.owner] += army.amount
                        
                        army.status = Army.ARRIVED
                        print(f"{army.owner}的{army.amount}万军队到达冲突区域{army.target_region_id}")
                        return
                else:
                    print(f"铁路运力不足，当前{railway.troops}，需要{army.amount}，容量{railway.get_capacity()}")
                    break
            
            # 跨区域移动
            else:
                print(f"尝试跨区域移动: 从{current_region.id}到{next_region.id}")
                # 在两个区域中查找连接这两个格子的铁路
                railway = None
                
                # 先在当前区域查找
                railway = current_region.find_railway_between(army.current_position, next_hex)
                
                # 如果当前区域没有，检查下一个区域
                if not railway:
                    railway = next_region.find_railway_between(army.current_position, next_hex)
                
                if not railway:
                    print(f"无法找到跨区域铁路连接({army.current_position.q},{army.current_position.r},{army.current_position.s})和({next_hex.q},{next_hex.r},{next_hex.s})")
                    
                    # 尝试直接移动到下一个区域的边界格子
                    edge_hex = self._find_nearest_edge_hex(next_region, army.current_position)
                    if edge_hex:
                        print(f"尝试移动到边界格子:({edge_hex.q},{edge_hex.r},{edge_hex.s})")
                        army.path_to_conflict.insert(0, edge_hex)  # 插入到路径的开头
                        continue
                    else:
                        print(f"无法找到边界格子，无法跨区域移动")
                        break
                
                # 检查铁路是否在建设中
                if railway.is_under_construction:
                    print(f"跨区域铁路在建设中，无法通过")
                    break
                
                # 检查铁路运力是否足够
                if railway.troops + army.amount <= railway.get_capacity():
                    print(f"跨区域铁路运力充足，移动军队从{current_region.id}到{next_region.id}")
                    # 移动到新位置
                    railway.troops += army.amount  # 增加铁路上的兵力
                    army.current_position = next_hex
                    army.path_to_conflict.pop(0)  # 移除已经到达的格子
                    
                    moves_made += 1
                    
                    # 检查是否已到达目标区域
                    if next_region.id == army.target_region_id:
                        # 到达冲突区域
                        if not hasattr(self.game_state, 'arrived_forces'):
                            self.game_state.arrived_forces = {}
                        
                        if army.owner not in self.game_state.arrived_forces:
                            self.game_state.arrived_forces[army.owner] = 0
                        self.game_state.arrived_forces[army.owner] += army.amount
                        
                        army.status = Army.ARRIVED
                        print(f"{army.owner}的{army.amount}万军队到达冲突区域{army.target_region_id}")
                        return
                else:
                    print(f"跨区域铁路运力不足，当前{railway.troops}，需要{army.amount}，容量{railway.get_capacity()}")
                    break
        
        # 移动结束，检查是否已完成所有移动
        if not army.path_to_conflict:
            # 如果路径为空，表示已经到达目标
            # 检查当前位置是否在目标区域
            current_region = None
            for region_id, region in self.game_state.regions.items():
                for hex_tile in region.hex_tiles:
                    if (hex_tile.q == army.current_position.q and 
                        hex_tile.r == army.current_position.r and 
                        hex_tile.s == army.current_position.s):
                        current_region = region
                        break
                if current_region:
                    break
            
            if current_region and current_region.id == army.target_region_id:
                # 到达冲突区域
                if not hasattr(self.game_state, 'arrived_forces'):
                    self.game_state.arrived_forces = {}
                
                if army.owner not in self.game_state.arrived_forces:
                    self.game_state.arrived_forces[army.owner] = 0
                self.game_state.arrived_forces[army.owner] += army.amount
                
                army.status = Army.ARRIVED
                print(f"{army.owner}的{army.amount}万军队到达冲突区域{army.target_region_id}")
        
        print(f"移动结束，当前位置:({army.current_position.q},{army.current_position.r},{army.current_position.s})，剩余路径长度:{len(army.path_to_conflict)}格")
    
    def _find_nearest_edge_hex(self, target_region, current_hex):
        """找到目标区域最近的边界格子
        
        Args:
            target_region (Region): 目标区域
            current_hex (HexTile): 当前格子
            
        Returns:
            HexTile: 最近的边界格子，如果没找到则返回None
        """
        if not target_region or not target_region.hex_tiles:
            return None
            
        # 获取所有区域的边界格子
        edge_hexes = []
        for hex_tile in target_region.hex_tiles:
            # 检查是否是边界格子
            is_edge = False
            for other_region_id, other_region in self.game_state.regions.items():
                if other_region.id == target_region.id:
                    continue
                
                for other_hex in other_region.hex_tiles:
                    # 如果两个格子相邻且在不同区域，则是边界格子
                    if hex_tile.is_adjacent(other_hex):
                        is_edge = True
                        break
                
                if is_edge:
                    break
            
            if is_edge:
                edge_hexes.append(hex_tile)
        
        # 找到最近的边界格子
        nearest_edge = None
        min_distance = float('inf')
        
        for edge_hex in edge_hexes:
            distance = edge_hex.distance(current_hex)
            if distance < min_distance:
                min_distance = distance
                nearest_edge = edge_hex
                
        return nearest_edge 