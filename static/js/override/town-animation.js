/**
 * 城镇动画管理脚本 - 移除合并城镇的永久动画，并提供短暂的升级动画
 */
(function() {
    // 创建覆盖合并城镇动画的样式
    function createOverrideStyles() {
        // 创建一个style元素
        const styleEl = document.createElement('style');
        styleEl.id = 'town-animation-override';
        
        // 定义样式内容 - 覆盖原有的无限循环动画
        styleEl.textContent = `
            /* 覆盖合并城镇样式，移除永久性动画 */
            .merged-town {
                filter: brightness(1.2) saturate(1.2);  /* 使图标更鲜明 */
                transform-origin: center;
                animation: none !important; /* 移除所有动画 */
            }
            
            /* 临时动画类 - 用于刚升级后的短暂效果 */
            .merged-town-temp-animation {
                animation: town-pulse 2s ease-in-out !important; /* 只播放一次，不循环 */
            }
            
            /* 单独定义用于临时效果的动画关键帧 */
            @keyframes town-pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        `;
        
        // 添加到文档头部
        document.head.appendChild(styleEl);
        console.log("已添加城镇动画覆盖样式");
    }
    
    // 在原始的upgradeTowns函数完成后添加临时动画
    function patchUpgradeTownsFunction() {
        // 保存原始函数的引用
        const originalUpgradeTowns = window.upgradeTowns;
        
        // 定义新的函数，添加临时动画效果
        window.upgradeTowns = function() {
            try {
                // 调用原始函数并保存其返回的Promise
                const originalPromise = originalUpgradeTowns.apply(this, arguments);
                
                // 检查返回值是否是Promise
                if (originalPromise && typeof originalPromise.then === 'function') {
                    // 在原始函数执行后添加临时动画
                    return originalPromise.then(data => {
                        if (data && data.success) {
                            console.log("城镇升级成功，添加临时动画效果");
                            
                            // 延迟一点时间，确保DOM已更新
                            setTimeout(() => {
                                // 查找所有合并城镇图标
                                const mergedTownIcons = document.querySelectorAll('.merged-town');
                                
                                // 添加临时动画类
                                mergedTownIcons.forEach(icon => {
                                    // 先移除可能存在的临时动画类
                                    icon.classList.remove('merged-town-temp-animation');
                                    
                                    // 触发重排以重置动画
                                    void icon.offsetWidth;
                                    
                                    // 添加临时动画类
                                    icon.classList.add('merged-town-temp-animation');
                                    
                                    // 动画结束后移除类
                                    setTimeout(() => {
                                        icon.classList.remove('merged-town-temp-animation');
                                    }, 2000);
                                });
                            }, 100);
                        }
                        
                        // 继续传递数据，不影响原有功能
                        return data;
                    }).catch(error => {
                        // 处理错误，确保错误会被正确传递
                        console.error("在处理城镇升级动画时捕获错误:", error);
                        throw error; // 重新抛出错误，保持原有的错误处理流程
                    });
                } else {
                    // 如果不是Promise，记录警告并返回原始结果
                    console.warn("upgradeTowns函数没有返回Promise，无法添加动画效果");
                    return originalPromise;
                }
            } catch (error) {
                console.error("在添加城镇动画时发生错误:", error);
                // 返回一个被拒绝的Promise
                return Promise.reject(error);
            }
        };
        
        console.log("已修补upgradeTowns函数以添加临时动画效果");
    }
    
    // 在文档加载完成后应用修改
    function init() {
        createOverrideStyles();
        
        // 如果upgradeTowns函数已存在，立即修补
        if (typeof window.upgradeTowns === 'function') {
            patchUpgradeTownsFunction();
        } else {
            // 否则等待函数定义完成后再修补
            const checkInterval = setInterval(() => {
                if (typeof window.upgradeTowns === 'function') {
                    patchUpgradeTownsFunction();
                    clearInterval(checkInterval);
                }
            }, 100);
            
            // 设置超时，防止无限等待
            setTimeout(() => {
                clearInterval(checkInterval);
                console.warn("无法找到upgradeTowns函数，动画修补失败");
            }, 10000);
        }
    }
    
    // 当DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();