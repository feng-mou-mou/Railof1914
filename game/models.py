"""
游戏核心数据模型
包含城市、铁路、地区、军队等实体
"""

class HexTile:
    """六边形地图格子"""
    
    def __init__(self, q, r, s):
        """初始化一个六边形格子
        
        Args:
            q (int): q坐标 (列)
            r (int): r坐标 (行)
            s (int): s坐标 (q + r + s = 0)
        """
        assert q + r + s == 0, "坐标必须满足 q + r + s = 0"
        self.q = q
        self.r = r
        self.s = s
        self.town = None  # 格子上的城镇
        self.terrain = "平原"  # 格子的地形
        self.id = ""  # 格子ID，用于识别格子属于哪个区域，格式为"{区域ID}-{q}-{r}-{s}"
        
    def __str__(self):
        return f"HexTile({self.q}, {self.r}, {self.s})"
    
    def distance(self, other):
        """计算与另一个格子的距离"""
        return max(
            abs(self.q - other.q), 
            abs(self.r - other.r), 
            abs(self.s - other.s)
        )
        
    def is_adjacent(self, other):
        """使用二维奇偶性判断两个格子是否相邻
        
        Args:
            other (HexTile): 另一个格子
            
        Returns:
            bool: 是否相邻
        """
        # 获取当前格子周围的所有相邻坐标
        neighbors = []
        if self.q % 2 == 0:  # 偶数列
            neighbors = [
                (self.q, self.r-1),     # 上
                (self.q, self.r+1),     # 下
                (self.q-1, self.r),     # 左上
                (self.q+1, self.r),     # 右上
                (self.q-1, self.r+1),   # 左下
                (self.q+1, self.r+1)    # 右下
            ]
        else:  # 奇数列
            neighbors = [
                (self.q, self.r-1),     # 上
                (self.q, self.r+1),     # 下
                (self.q-1, self.r-1),   # 左上
                (self.q+1, self.r-1),   # 右上
                (self.q-1, self.r),     # 左下
                (self.q+1, self.r)      # 右下
            ]
        
        # 检查另一个格子的坐标是否在相邻列表中
        return (other.q, other.r) in neighbors


class Town:
    """城镇"""
    
    VILLAGE = "village"
    SMALL_CITY = "small_city"
    LARGE_CITY = "large_city"
    
    # 城镇等级配置
    TOWN_CONFIG = {
        VILLAGE: {"cost": 50, "population": 100, "gdp": 20},
        SMALL_CITY: {"cost": 150, "population": 200, "gdp": 50},
        LARGE_CITY: {"cost": 300, "population": 400, "gdp": 120}
    }
    
    # 升级路径
    UPGRADE_PATH = {
        VILLAGE: SMALL_CITY,
        SMALL_CITY: LARGE_CITY
    }
    
    # 升级成本
    UPGRADE_COST = {
        VILLAGE: 100,  # 村落升级到小城市的成本
        SMALL_CITY: 200  # 小城市升级到大城市的成本
    }
    
    def __init__(self, name, level, owner):
        """初始化一个城镇
        
        Args:
            name (str): 城镇名称
            level (str): 城镇等级 (村落/小城市/大城市)
            owner (str): 所属阵营
        """
        self.name = name
        self.level = level
        self.owner = owner
        self.population = 0  # 初始人口为0，完成建设后才会增加
        self.mobilized = 0
        self.is_under_construction = True  # 新增：是否在建设中
        
    def complete_construction(self):
        """完成建设"""
        self.is_under_construction = False
        self.population = self.TOWN_CONFIG[self.level]["population"]
        
    def get_gdp(self):
        """获取GDP产出（建设中时无产出）"""
        if self.is_under_construction:
            return 0
        return self.TOWN_CONFIG[self.level]["gdp"]
    
    def get_max_mobilization(self):
        """获取最大动员数量（建设中时不可动员）"""
        if self.is_under_construction:
            return 0
        return self.population
        
    def can_upgrade(self):
        """检查是否可以升级"""
        return (
            not self.is_under_construction and  # 不在建设中
            self.level in self.UPGRADE_PATH  # 有下一级可升级
        )
    
    def get_upgrade_cost(self):
        """获取升级成本"""
        if not self.can_upgrade():
            return None
        return self.UPGRADE_COST[self.level]
    
    def get_next_level(self):
        """获取下一级别"""
        if not self.can_upgrade():
            return None
        return self.UPGRADE_PATH[self.level]


class Railway:
    """铁路类"""
    
    # 铁路等级
    LEVEL_1 = "level_1"
    LEVEL_2 = "level_2"
    LEVEL_3 = "level_3"
    
    # 铁路配置
    RAILWAY_CONFIG = {
        LEVEL_1: {"cost": 30, "capacity": 100},
        LEVEL_2: {"cost": 60, "capacity": 300},
        LEVEL_3: {"cost": 100, "capacity": 1000}
    }
    
    def __init__(self, start_hex, end_hex, level=LEVEL_1):
        """初始化一条铁路
        
        Args:
            start_hex (HexTile): 起始格子
            end_hex (HexTile): 终止格子
            level (str): 铁路等级
        """
        # 使用新的二维奇偶性相邻判断方法
        if not start_hex.is_adjacent(end_hex):
            raise ValueError("铁路只能连接相邻格子")
            
        self.start_hex = start_hex
        self.end_hex = end_hex
        self.level = level
        self.troops = 0
        self.is_under_construction = True  # 新增：是否在建设中
        
    def complete_construction(self):
        """完成建设"""
        self.is_under_construction = False
        
    def get_capacity(self):
        """获取运力（建设中时无运力）"""
        if self.is_under_construction:
            return 0
        return self.RAILWAY_CONFIG[self.level]["capacity"]


class Region:
    """游戏地区"""
    
    def __init__(self, region_id, name, hex_tiles=None):
        """初始化一个游戏地区
        
        Args:
            region_id (str): 地区ID
            name (str): 地区名称
            hex_tiles (list): 地区包含的六边形格子列表
        """
        self.id = region_id
        self.name = name
        self.hex_tiles = hex_tiles or []
        self.towns = []  # 区域内的城镇
        self.railways = []  # 区域内的铁路
        
    def add_hex(self, hex_tile):
        """添加一个六边形格子到地区"""
        # 设置格子ID
        hex_tile.id = f"{self.id}-{hex_tile.q}-{hex_tile.r}-{hex_tile.s}"
        self.hex_tiles.append(hex_tile)
        
    def add_town(self, town, hex_tile):
        """在指定格子上添加城镇
        
        Args:
            town (Town): 要添加的城镇
            hex_tile (HexTile): 城镇所在的格子
            
        Returns:
            bool: 是否成功添加
        """
        # 检查格子是否已有城镇
        if hex_tile.town:
            print(f"格子({hex_tile.q},{hex_tile.r},{hex_tile.s})已有城镇")
            return False
        
        # 检查格子是否属于该区域
        if hex_tile not in self.hex_tiles:
            print(f"格子({hex_tile.q},{hex_tile.r},{hex_tile.s})不属于该区域")
            return False
        
        # 根据城镇等级检查空间需求和城镇数量限制
        # 村落：最多4个
        # 小城市：最多2个
        # 大城市：最多1个
        town_counts = {
            Town.VILLAGE: sum(1 for t in self.towns if t.level == Town.VILLAGE),
            Town.SMALL_CITY: sum(1 for t in self.towns if t.level == Town.SMALL_CITY),
            Town.LARGE_CITY: sum(1 for t in self.towns if t.level == Town.LARGE_CITY)
        }
        
        if town.level == Town.VILLAGE and town_counts[Town.VILLAGE] >= 4:
            print(f"区域{self.name}已达到村落数量上限(4)")
            return False
        elif town.level == Town.SMALL_CITY and town_counts[Town.SMALL_CITY] >= 2:
            print(f"区域{self.name}已达到小城市数量上限(2)")
            return False
        elif town.level == Town.LARGE_CITY and town_counts[Town.LARGE_CITY] >= 1:
            print(f"区域{self.name}已达到大城市数量上限(1)")
            return False
        
        # 添加城镇
        hex_tile.town = town
        self.towns.append(town)
        print(f"成功在区域{self.name}添加城镇{town.name}(等级:{town.level})")
        return True
        
    def add_railway(self, railway):
        """添加一条铁路"""
        self.railways.append(railway)
        
    def find_path_to_conflict(self, start_hex, conflict_region_id):
        """查找从起点到冲突区域的最短铁路路径
        
        Args:
            start_hex (HexTile): 起始格子
            conflict_region_id (str): 冲突区域ID
            
        Returns:
            list: 路径上的格子和铁路列表，如果不存在则返回空列表
        """
        # 从游戏控制器获取全局游戏状态，以访问所有区域
        from .controller import GameController
        game_controller = GameController.get_instance()
        game_state = game_controller.game_state
        
        # 先获取目标冲突区域的所有格子
        conflict_region = None
        for region in game_state.regions.values():
            if region.id == conflict_region_id:
                conflict_region = region
                break
                
        if not conflict_region:
            print(f"找不到冲突区域: {conflict_region_id}")
            return []
            
        # 获取冲突区域所有格子的坐标集合，用于快速查找
        conflict_hex_coords = {(hex_tile.q, hex_tile.r, hex_tile.s) for hex_tile in conflict_region.hex_tiles}
        
        # 构建全局铁路网络图（所有区域的铁路网络）
        graph = {}  # 格子 -> 相邻格子列表
        railway_map = {}  # 格子 -> {相邻格子 -> 铁路}
        hex_map = {}  # 坐标字符串 -> 格子对象
        
        # 首先建立所有格子的映射，方便后续查找
        for region in game_state.regions.values():
            for hex_tile in region.hex_tiles:
                hex_key = f"{hex_tile.q},{hex_tile.r},{hex_tile.s}"
                hex_map[hex_key] = hex_tile
                graph[hex_tile] = []
                railway_map[hex_tile] = {}
        
        # 然后添加所有区域的铁路连接
        for region in game_state.regions.values():
            for railway in region.railways:
                if railway.is_under_construction:
                    continue  # 跳过建设中的铁路
                
                # 双向连接
                graph[railway.start_hex].append(railway.end_hex)
                graph[railway.end_hex].append(railway.start_hex)
                
                # 记录连接这两个格子的铁路
                railway_map[railway.start_hex][railway.end_hex] = railway
                railway_map[railway.end_hex][railway.start_hex] = railway
        
        # 如果起点不在图中，无法到达
        if start_hex not in graph:
            print(f"起点{start_hex.q},{start_hex.r},{start_hex.s}不在铁路网络中")
            return []
        
        # 使用广度优先搜索寻找路径
        queue = [(start_hex, [start_hex], [])]  # (当前格子, 路径, 使用的铁路)
        visited = {start_hex}
        
        while queue:
            current, path, railways = queue.pop(0)
            
            # 检查当前格子是否已在冲突区域内（精确匹配坐标）
            current_coords = (current.q, current.r, current.s)
            if current_coords in conflict_hex_coords:
                print(f"找到到冲突区域{conflict_region_id}的路径，长度: {len(path)-1}")
                return {
                    'path': path,
                    'railways': railways
                }
            
            # 遍历相邻格子
            if current in graph:  # 确保当前格子在图中
                for neighbor in graph[current]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        # 添加连接的铁路到路径
                        new_railways = railways + [railway_map[current][neighbor]]
                        queue.append((neighbor, path + [neighbor], new_railways))
        
        print(f"找不到从{start_hex.q},{start_hex.r},{start_hex.s}到冲突区域{conflict_region_id}的路径")
        return []
        
    def find_railway_between(self, hex1, hex2):
        """查找连接两个格子的铁路
        
        Args:
            hex1 (HexTile): 第一个格子
            hex2 (HexTile): 第二个格子
            
        Returns:
            Railway: 连接两个格子的铁路，如果不存在则返回None
        """
        for railway in self.railways:
            if (railway.start_hex == hex1 and railway.end_hex == hex2) or \
               (railway.start_hex == hex2 and railway.end_hex == hex1):
                return railway
        return None
    
    def get_gdp(self):
        """计算地区的总GDP产出"""
        base_gdp = sum(town.get_gdp() for town in self.towns)
        
        # 检查城镇是否互联
        if self._check_towns_connected() and len(self.towns) > 1:
            return base_gdp * 1.2  # 互联加成20%
        return base_gdp
    
    def _check_towns_connected(self):
        """检查地区内所有城镇是否通过铁路互联"""
        # 简化实现，实际需要用图算法检查连通性
        if not self.towns or not self.railways:
            return False
        # 构建连通图
        connections = {}
        for town in self.towns:
            connections[town] = []
        for railway in self.railways:
            start_town = railway.start_hex.town
            end_town = railway.end_hex.town
            if start_town and end_town:
                connections[start_town].append(end_town)
                connections[end_town].append(start_town)
        # TODO: 完善连通性检查
        return True

    def are_towns_connected(self, town1, town2):
        """检查两个城镇是否通过铁路互联"""
        # 如果没有铁路直接返回False
        if not self.railways:
            return False
        # 构建邻接表
        graph = {t: [] for t in self.towns}
        for railway in self.railways:
            a = railway.start_hex.town
            b = railway.end_hex.town
            if a and b:
                graph[a].append(b)
                graph[b].append(a)
        # 广度优先搜索判断连通性
        visited = {town1}
        queue = [town1]
        while queue:
            curr = queue.pop(0)
            if curr == town2:
                return True
            for nbr in graph.get(curr, []):
                if nbr not in visited:
                    visited.add(nbr)
                    queue.append(nbr)
        return False


class Army:
    """军队单位类"""
    
    # 军队状态
    GENERATING = "生成中"  # 刚动员的回合
    LOADING = "装载中"     # 第二回合
    TRANSPORTING = "运输中" # 第三回合及以后
    ARRIVED = "已抵达"     # 已到达目的地
    
    def __init__(self, source_town, amount, owner):
        """初始化一个军队单位
        
        Args:
            source_town (Town): 来源城镇
            amount (int): 兵力数量
            owner (str): 所属阵营
        """
        self.source_town = source_town  # 来源城镇
        self.source_town_name = source_town.name  # 存储城镇名称以便序列化
        self.amount = amount            # 兵力数量
        self.owner = owner              # 所属阵营
        self.status = self.GENERATING   # 初始状态
        self.current_position = None    # 当前位置的六边形格子
        self.path = []                  # 计划路径
        self.movement_points = 0        # 当前回合剩余移动点数
        self.target_region_id = None    # 目标区域ID
        self.current_railway = None     # 当前所在铁路
        self.path_to_conflict = []      # 到冲突区域的路径
        self.generation_time = 0        # 生成的回合数


class GameState:
    """游戏状态"""
    
    PROTECTION_PHASE = "保护期"
    TENSION_PHASE = "紧张期"
    WAR_PHASE = "战争期"
    
    def __init__(self):
        """初始化游戏状态"""
        self.round = 1
        self.max_rounds = 75
        self.phase = self.PROTECTION_PHASE
        self.regions = {}  # 地区字典
        self.players = ["德军", "协约国"]  # 玩家阵营
        self.current_player = "德军"  # 当前回合玩家
        self.war_declared = False  # 是否已宣战
        self.war_countdown = 0  # 战争倒计时
        
        # 游戏结束相关属性
        self.game_ended = False  # 游戏是否已结束
        self.winner = None  # 胜利者
        self.final_forces = {}  # 最终兵力情况
        
        # 定义势力划分
        self.factions = {
            "德军": ["德国", "比利时"],  # 德意志帝国包括德国和比利时
            "协约国": ["法国"]          # 协约国包括法国
        }
        
        # 定义冲突地区
        self.conflict_regions = {
            "德军": "GE-3",    # 德意志帝国冲突区
            "协约国": "FR-3"   # 协约国冲突区
        }
        
        # 军队列表
        self.armies = []
        
        # 冲突区域内已到达的兵力
        self.arrived_forces = {
            "德军": 0,
            "协约国": 0
        }
        
    def get_phase(self):
        """获取当前游戏阶段"""
        if self.round <= 30:
            return self.PROTECTION_PHASE
        elif self.round <= 40:
            return self.TENSION_PHASE
        else:
            return self.WAR_PHASE
            
    def add_region(self, region):
        """添加一个地区"""
        self.regions[region.id] = region
        
    def next_round(self):
        """进入下一回合"""
        self.round += 1
        self.phase = self.get_phase()
        
        # 战争倒计时
        if self.war_declared:
            self.war_countdown -= 1
            if self.war_countdown <= 0:
                self._resolve_conflict()
                
        return self.round <= self.max_rounds
    
    def declare_war(self, player):
        """宣战
        
        Args:
            player (str): 宣战的玩家阵营
            
        Returns:
            bool: 是否宣战成功
        """
        if self.phase != self.TENSION_PHASE or self.war_declared:
            return False
            
        # 根据玩家阵营获取对应的冲突区域
        region_id = self.conflict_regions.get(player)
        if region_id in self.regions:
            self.conflict_region = self.regions[region_id]
            self.war_declared = True
            self.war_countdown = 3  # 3回合后结算
            return True
        return False
    
    def get_player_regions(self, player):
        """获取玩家可以操作的区域
        
        Args:
            player (str): 玩家阵营
            
        Returns:
            list: 可操作区域列表
        """
        player_nations = self.factions.get(player, [])
        player_regions = []
        
        for region_id, region in self.regions.items():
            # 根据区域ID前缀判断国家
            nation_prefix = region_id.split('-')[0]
            nation = {"FR": "法国", "BE": "比利时", "GE": "德国"}.get(nation_prefix)
            
            if nation in player_nations:
                player_regions.append(region)
                
        return player_regions
    
    def _resolve_conflict(self):
        """解决冲突，确定胜利者"""
        if not self.conflict_region:
            return None
            
        # 计算各方在冲突地区的兵力
        forces = {player: 0 for player in self.players}
        
        # 计算在对应冲突地区的已到达兵力
        for player in self.players:
            forces[player] = self.arrived_forces.get(player, 0)
                
        # 确定胜利者
        winner = max(forces.items(), key=lambda x: x[1])[0]
        return winner 