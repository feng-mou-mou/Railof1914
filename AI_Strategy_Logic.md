# AI理想决策逻辑设计

## 核心决策框架

### 1. 阶段性策略划分
根据游戏回合设置不同阶段优先级：

**早期发展（1-10回合）**
- 优先在高价值区域（资源丰富、靠近冲突区）建立基础村落网络
- 构建基本铁路连接，形成小型互联网络
- 目标：建立10-12个基础村落，至少3-4个小型互联网络

**中期扩张（11-20回合）**
- 优先升级已互联村落为小城市
- 扩展铁路网络，连接所有村落
- 开始向冲突区域延伸铁路线
- 目标：至少有5-6个小城市，80%的村落互联

**后期战备（21-30回合）**
- 优先升级小城市为大城市
- 完成全网络铁路连接
- 确保冲突区域有多条铁路路径
- 在战略要地布局最后的村落
- 目标：至少2-3个大城市，100%村落互联

**战争阶段（31-40回合）**
- 停止建设，全力动员军队
- 在最有优势的冲突区域宣战
- 持续监控兵力对比
- 目标：最大化在目标冲突区的兵力

### 2. 回合内优先级系统

**GDP足够时的动作优先级（高→低）：**

1. **保护期前期（1-10回合）**
   - 建设村落（优先考虑资源丰富区域）
   - 连接关键铁路以形成小型互联网
   - 升级拥有战略位置的村落（如接近冲突区）

2. **保护期中期（11-20回合）**
   - 升级现有村落到小城市（优先已互联的）
   - 扩展铁路网络，形成大型互联群
   - 在战略缺口处建设新村落

3. **保护期后期（21-30回合）**
   - 升级小城市为大城市（优先靠近冲突区的）
   - 完成全铁路网络互联
   - 修建直达冲突区的铁路干线
   - 在关键节点建立最后的村落

4. **紧张期（31-40回合）**
   - 动员所有可用军队
   - 选择最有利冲突区宣战
   - 任何剩余GDP用于最后的关键铁路连接

### 3. 空间策略规划

**村落布局规划：**
- 村落间距保持在1-2格，便于后期升级
- 沿铁路干线建设"链状"村落群
- 围绕冲突区域形成"扇形"村落网络
- 保留升级空间，避免过度拥挤

**铁路网络设计：**
- "轮辐式"铁路网络，以最重要城市为中心
- 构建多条通往冲突区的独立路径
- 优先连接低建设成本的相邻地块
- 确保每个城镇至少有两条连接路径（冗余保障）

### 4. 智能资源分配算法

**GDP分配：**
- 预留30%GDP作为机动资金
- 40%用于城镇建设/升级
- 30%用于铁路网络扩展
- 保护期末期，将预留资金转为战备资金

**升级价值评估公式：**
```
升级价值 = 基础GDP增益 + 互联加成价值 + 地理位置战略价值 + 距离战争阶段近程度系数
```

**铁路价值评估公式：**
```
铁路价值 = 连接城镇数量 × 互联加成 + 通往冲突区路径价值 + 网络冗余价值
```

### 5. 适应性调整机制

- 每5回合评估当前策略有效性
- 如落后于预期发展目标，增加建设密度
- 如玩家集中发展某一冲突区，转移资源至其他冲突区
- 监控GDP增长曲线，确保呈指数增长

### 6. 宣战决策逻辑

判定宣战最佳时机：
- 己方在至少一个冲突区域拥有60%以上兵力优势
- 己方主要城市到该冲突区都有畅通铁路连接
- 回合数最好在65-70之间（留足动员时间）
- 未动员的潜在兵力不超过20%（充分利用人力）

## 具体实现

### 1. 早期建设规划（1-10回合）

```javascript
function earlyGameStrategy() {
    // 计算每个可建设位置的战略价值
    const buildLocations = getPotentialBuildLocations();
    const valuedLocations = buildLocations.map(location => ({
        ...location,
        value: calculateLocationValue(location, "early")
    })).sort((a, b) => b.value - a.value);
    
    // 获取可用GDP
    const availableGDP = getCurrentAIGDP();
    const villageCost = 50; // 假设村落成本为50
    
    // 建设高价值村落直到GDP不足或无高价值位置
    while (availableGDP >= villageCost && valuedLocations.length > 0) {
        const bestLocation = valuedLocations.shift();
        buildVillage(bestLocation.regionId, bestLocation.coords);
        availableGDP -= villageCost;
    }
    
    // 剩余GDP用于连接铁路
    if (availableGDP >= 30) { // 假设铁路成本为30
        buildCriticalRailwayConnections(availableGDP);
    }
}
```

### 2. 中期升级与互联（11-20回合）

```javascript
function midGameStrategy() {
    // 评估当前村落的升级价值
    const upgradeOptions = getUpgradeOptions();
    const rankedUpgrades = upgradeOptions.map(option => ({
        ...option,
        value: calculateUpgradeValue(option, "mid")
    })).sort((a, b) => b.value - a.value);
    
    // 获取可用GDP
    let availableGDP = getCurrentAIGDP();
    const upgradeCost = 150; // 假设升级小城市成本为150
    
    // 优先升级高价值村落对
    while (availableGDP >= upgradeCost && rankedUpgrades.length > 0) {
        const bestUpgrade = rankedUpgrades.shift();
        upgradeTown(bestUpgrade.regionId, bestUpgrade.towns, "town");
        availableGDP -= upgradeCost;
    }
    
    // 检查互联状态
    const connectivityStatus = assessRailwayConnectivity();
    if (connectivityStatus.completionRate < 0.8) {
        // 优先完成铁路互联
        buildConnectionRailways(availableGDP, connectivityStatus.gaps);
    } else {
        // 开始向冲突区域延伸
        extendRailwaysToConflictRegions(availableGDP);
    }
}
```

### 3. 后期完善与战备（21-30回合）

```javascript
function lateGameStrategy() {
    // 检查冲突区连接状态
    const conflictConnectivity = assessConflictRegionConnectivity();
    let availableGDP = getCurrentAIGDP();
    
    // 确保到冲突区的铁路畅通
    if (!conflictConnectivity.isFullyConnected) {
        const railwayCost = completeConflictRegionConnections(conflictConnectivity.missingLinks);
        availableGDP -= railwayCost;
    }
    
    // 升级战略位置的小城市为大城市
    const strategicUpgrades = getStrategicCityUpgrades();
    const cityCost = 250; // 假设升级大城市成本为250
    
    while (availableGDP >= cityCost && strategicUpgrades.length > 0) {
        const targetUpgrade = strategicUpgrades.shift();
        upgradeTown(targetUpgrade.regionId, targetUpgrade.towns, "city");
        availableGDP -= cityCost;
    }
    
    // 评估各冲突区战略价值，预判宣战区域
    const conflictZoneValue = evaluateConflictZones();
    const primaryConflictZone = conflictZoneValue[0].id;
    
    // 预留动员资金，增强预判宣战区域的连接
    if (availableGDP > 300) {
        reinforceConflictZoneConnections(primaryConflictZone, availableGDP - 300);
    }
}
```

### 4. 紧张期军事决策（31-40回合）

```javascript
function warPhaseStrategy() {
    // 评估各冲突区域的战略价值和当前优势
    const conflictZones = evaluateConflictZones();
    const bestConflictZone = conflictZones[0].id;
    
    // 计算己方和对方在各冲突区的兵力
    const forceAssessment = assessForceDistribution();
    
    // 动员城市军队，优先高人口城市
    mobilizeAllAvailableForces(bestConflictZone);
    
    // 决定是否宣战
    if (forceAssessment[bestConflictZone].advantageRatio > 1.6 && 
        getCurrentRound() >= 65) {
        declareWar(bestConflictZone);
    }
    
    // 每回合更新兵力分析和宣战决策
    updateWarAssessment();
}
``` 