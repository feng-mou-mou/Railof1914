"""
六角形地图生成器
用于创建游戏地图和区域，基于France/Belgium/Germany地图
"""

from .models import HexTile, Region, Town, Railway

class MapGenerator:
    """地图生成器"""
    
    def __init__(self):
        """初始化地图生成器"""
        self.hex_tiles = {}  # 存储所有格子，键为坐标(q,r,s)元组
        self.regions = {}  # 存储所有区域
        
    def generate_map(self):
        """生成欧洲地图，包含法国、比利时和德国"""
        self._create_regions()
        return self.regions
    
    def _create_regions(self):
        """根据规范创建游戏区域"""
        # 创建法国区域
        self._create_france_regions()
        # 创建比利时区域
        self._create_belgium_regions()
        # 创建德国区域
        self._create_germany_regions()
        
    def _create_hex_tile(self, q, r):
        """创建一个六边形格子并添加到地图"""
        s = -q - r
        if (q, r, s) not in self.hex_tiles:
            hex_tile = HexTile(q, r, s)
            self.hex_tiles[(q, r, s)] = hex_tile
        return self.hex_tiles[(q, r, s)]
        
    def _create_france_regions(self):
        """创建法国区域"""
        # 创建法国的7个区域
        # FR-1区域
        fr1 = Region("FR-1", "法国-诺曼底")
        self._add_region_hex_tiles(fr1, self._generate_region_coords("FR-1"))
        self.regions[fr1.id] = fr1
        
        # FR-2区域
        fr2 = Region("FR-2", "法国-西部")
        self._add_region_hex_tiles(fr2, self._generate_region_coords("FR-2"))
        self.regions[fr2.id] = fr2
        
        # FR-3区域，法国冲突区
        fr3 = Region("FR-3", "法国-北部冲突区")
        self._add_region_hex_tiles(fr3, self._generate_region_coords("FR-3"))
        self.regions[fr3.id] = fr3
        
        # FR-4区域
        fr4 = Region("FR-4", "法国-中部")
        self._add_region_hex_tiles(fr4, self._generate_region_coords("FR-4"))
        self.regions[fr4.id] = fr4
        
        # FR-5区域
        fr5 = Region("FR-5", "法国-南部")
        self._add_region_hex_tiles(fr5, self._generate_region_coords("FR-5"))
        self.regions[fr5.id] = fr5
        
        # FR-6区域
        fr6 = Region("FR-6", "法国-东南部")
        self._add_region_hex_tiles(fr6, self._generate_region_coords("FR-6"))
        self.regions[fr6.id] = fr6
        
        # FR-7区域
        fr7 = Region("FR-7", "法国-东部")
        self._add_region_hex_tiles(fr7, self._generate_region_coords("FR-7"))
        self.regions[fr7.id] = fr7
    
    def _create_belgium_regions(self):
        """创建比利时区域"""
        # 创建比利时的1个区域
        # BE-1区域
        be1 = Region("BE-1", "比利时")
        self._add_region_hex_tiles(be1, self._generate_region_coords("BE-1"))
        self.regions[be1.id] = be1
    
    def _create_germany_regions(self):
        """创建德国区域"""
        # 创建德国的7个区域
        # GE-1区域
        ge1 = Region("GE-1", "德国-西北部")
        self._add_region_hex_tiles(ge1, self._generate_region_coords("GE-1"))
        self.regions[ge1.id] = ge1
        
        # GE-2区域
        ge2 = Region("GE-2", "德国-北部")
        self._add_region_hex_tiles(ge2, self._generate_region_coords("GE-2"))
        self.regions[ge2.id] = ge2
        
        # GE-3区域，德国冲突区
        ge3 = Region("GE-3", "德国-西部冲突区")
        self._add_region_hex_tiles(ge3, self._generate_region_coords("GE-3"))
        self.regions[ge3.id] = ge3
        
        # GE-4区域
        ge4 = Region("GE-4", "德国-东北部")
        self._add_region_hex_tiles(ge4, self._generate_region_coords("GE-4"))
        self.regions[ge4.id] = ge4
        
        # GE-5区域
        ge5 = Region("GE-5", "德国-中部")
        self._add_region_hex_tiles(ge5, self._generate_region_coords("GE-5"))
        self.regions[ge5.id] = ge5
        
        # GE-6区域
        ge6 = Region("GE-6", "德国-南部")
        self._add_region_hex_tiles(ge6, self._generate_region_coords("GE-6"))
        self.regions[ge6.id] = ge6
        
        # GE-7区域
        ge7 = Region("GE-7", "德国-东南部")
        self._add_region_hex_tiles(ge7, self._generate_region_coords("GE-7"))
        self.regions[ge7.id] = ge7
    
    def _add_region_hex_tiles(self, region, coords_list):
        """为区域添加六边形格子"""
        for q, r in coords_list:
            hex_tile = self._create_hex_tile(q, r)
            region.add_hex(hex_tile)
    
    def _generate_region_coords(self, region_id):
        """根据区域ID生成该区域内的坐标列表
        根据新提供的地图布局生成坐标
        """
        # 完整的地图坐标
        region_coords = {
            # 法国区域
            "FR-1": [
                (0, 0),
                (-1, 0), (-1, -1), (-1, -2), (-1, -3), (-1, 1), 
                (-2, -1), (-2, 0), (-2, 1), (-2, -2), (-2, -3),
                (-3, 0), (-3, -1), (-3, -2), (-3, -3), (-3, 1), (-3, 2),
                (-4, 0), (-4, -1), (-4, -2), (-4, -3), (-4, 1),
                (-5, 0), (-5, -1), (-5, -2), (-5, -3), (-5, 1), (-5, 2),
                (-6, 0), (-6, -1), (-6, -2), (-6, -3), (-6, 1),
                (-7, 0), (-7, 1), (-7, 2)
            ],
            "FR-2": [
                (-4, 2), (-4, 3), (-4, 4), (-4, 5), (-4, 6),
                (-5, 3), (-5, 4), (-5, 5), (-5, 6), (-5, 7),
                (-6, 2), (-6, 3), (-6, 4), (-6, 5), (-6, 6), (-6, 7),
                (-7, 4), (-7, 5), (-7, 6), (-7, 7),
                (-8, 5), (-8, 6), (-8, 7)
            ],
            "FR-3": [
                (-2, 2),
                (-1, 2), (-1, 3),
                (0, 1), (0, 2), (0, 3),
                (1, 1), (1, 2), (1, 3), (1, 4),
                (2, 1), (2, 2), (2, 3),
                (3, 2), (3, 3), (3, 4),
                (4, 2), (4, 3), (4, 4),
                (5, 3), (5, 4), (5, 5),
                (6, 3), (6, 4)
            ],
            "FR-4": [
                (-3, 3), (-3, 4), (-3, 5), (-3, 6), (-3, 7),
                (-2, 3), (-2, 4), (-2, 5), (-2, 6), (-2, 7),
                (-1, 4), (-1, 5), (-1, 6), (-1, 7),
                (0, 4), (0, 5), (0, 6), (0, 7),
                (1, 5), (1, 6), (1, 7), (1, 8),
                (2, 4), (2, 5), (2, 6), (2, 7), (2, 8),
                (3, 5), (3, 6),
                (4, 5)
            ],
            "FR-5": [
                (-8, 10), (-8, 11),
                (-7, 9), (-7, 10), (-7, 11), (-7, 12),
                (-6, 8), (-6, 9), (-6, 10), (-6, 11),
                (-5, 8), (-5, 9), (-5, 10), (-5, 11), (-5, 12),
                (-4, 7), (-4, 8), (-4, 9), (-4, 10), (-4, 11),
                (-3, 11), (-3, 12)
            ],
            "FR-6": [
                (-3, 8), (-3, 9), (-3, 10),
                (-2, 8), (-2, 9), (-2, 10), (-2, 11),
                (-1, 8), (-1, 9), (-1, 10), (-1, 11), (-1, 12),
                (0, 8), (0, 9), (0, 10), (0, 11),
                (1, 9), (1, 10), (1, 11), (1, 12),
                (2, 9), (2, 10), (2, 11),
                (3, 10)
            ],
            "FR-7": [
                (3, 7), (3, 8), (3, 9),
                (4, 6), (4, 7), (4, 8),
                (5, 6), (5, 7), (5, 8),
                (6, 6), (6, 7),
                (7, 7), (7, 8),
                (8, 7)
            ],
            
            # 比利时区域
            "BE-1": [
                (0, -3), (0, -2), (0, -1),
                (1, -3), (1, -2), (1, -1), (1, 0),
                (2, -3), (2, -2), (2, -1), (2, 0),
                (3, -3), (3, -2), (3, -1), (3, 0), (3, 1),
                (4, -3), (4, -2), (4, -1), (4, 0), (4, 1),
                (5, -3), (5, -2)
            ],
            
            # 德国区域
            "GE-1": [
                (5, -1), (5, 0),
                (6, -3), (6, -2), (6, -1), (6, 0),
                (7, -2), (7, -1), (7, 0),
                (8, -3), (8, -2), (8, -1),
                (9, -2), (9, -1),
                (10, -3), (10, -2), (10, -1)
            ],
            "GE-2": [
                (11, -3), (11, -2), (11, -1),
                (12, -3), (12, -2), (12, -1),
                (13, -3), (13, -2), (13, -1), (13, 0),
                (14, -3), (14, -2), (14, -1)
            ],
            "GE-3": [
                (5, 1), (5, 2),
                (6, 1), (6, 2),
                (7, 1), (7, 2), (7, 3),
                (8, 0), (8, 1), (8, 2),
                (9, 0), (9, 1), (9, 2), (9, 3),
                (10, 0), (10, 1), (10, 2),
                (11, 0), (11, 1), (11, 2),
                (12, 0), (12, 1)
            ],
            "GE-4": [
                (15, -3), (15, -2), (15, -1), (15, 0),
                (16, -3), (16, -2), (16, -1),
                (17, -3), (17, -2), (17, -1), (17, 0),
                (18, -3), (18, -2), (18, -1)
            ],
            "GE-5": [
                (6, 5),
                (7, 4), (7, 5), (7, 6),
                (8, 3), (8, 4), (8, 5), (8, 6),
                (9, 4), (9, 5), (9, 6), (9, 7),
                (10, 5), (10, 6)
            ],
            "GE-6": [
                (10, 3), (10, 4),
                (11, 3), (11, 4), (11, 5),
                (12, 2), (12, 3), (12, 4),
                (13, 3), (13, 4), (13, 5)
            ],
            "GE-7": [
                (11, 6), (11, 7),
                (12, 5), (12, 6), (12, 7),
                (13, 6), (13, 7), (13, 8),
                (14, 5), (14, 6), (14, 7)
            ]
        }
        
        return region_coords.get(region_id, [])


def create_demo_game_map():
    """创建欧洲地图"""
    generator = MapGenerator()
    regions = generator.generate_map()
    
    # 不需要初始化城镇，玩家从零开始
    
    return regions 