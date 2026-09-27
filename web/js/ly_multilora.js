// LY-多lora加载 — 前端增强
// 1) 开关关闭时，该槽位变灰且不可点
// 2) 打开一个还没选 LoRA 的空槽时，自动帮你选中列表里的第一个 LoRA
// 控件名本身已是中文（定义在 __init__.py），这里不再改标签

import { app } from "../../scripts/app.js";

const NODE_NAME = "LY Multi LoRA Loader (6)";
const SLOTS = 6;

function findWidget(node, name) {
    return (node.widgets || []).find((w) => w.name === name);
}

function slotWidgets(node, i) {
    return {
        enable: findWidget(node, `启用 ${i}`),
        lora: findWidget(node, `LoRA ${i}`),
        type: findWidget(node, `类型 ${i}`),
        strength: findWidget(node, `强度 ${i}`),
    };
}

function setSlotEnabled(node, i, on) {
    const { lora, type, strength } = slotWidgets(node, i);
    for (const w of [lora, type, strength]) {
        if (!w) continue;
        try { w.disabled = !on; } catch (e) { /* 老版本不支持 disabled，忽略 */ }
        if (w.inputEl) {
            w.inputEl.style.opacity = on ? "1" : "0.35";
            w.inputEl.style.pointerEvents = on ? "" : "none";
        }
        if (w.element) {
            w.element.style.opacity = on ? "1" : "0.35";
            w.element.style.pointerEvents = on ? "" : "none";
        }
    }
}

function applyAllStates(node) {
    for (let i = 1; i <= SLOTS; i++) {
        const en = findWidget(node, `启用 ${i}`);
        if (!en) continue;
        const on = !!en.value;
        setSlotEnabled(node, i, on);

        if (on) {
            // 打开空槽 → 自动选中第一个真实 LoRA
            const loraW = findWidget(node, `LoRA ${i}`);
            if (loraW && (loraW.value === "None" || loraW.value == null)) {
                const options = (loraW.options && loraW.options.values) || [];
                const first = options.find((v) => v !== "None");
                if (first) loraW.value = first;
            }
        }
    }
    node.graph && node.graph.setDirtyCanvas(true, true);
}

app.registerExtension({
    name: "LY.MultiLoraLoader",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            const node = this;

            // 开关 / 类型变化时刷新整组状态
            for (let i = 1; i <= SLOTS; i++) {
                for (const key of [`启用 ${i}`, `类型 ${i}`]) {
                    const w = findWidget(this, key);
                    if (!w) continue;
                    const orig = w.callback;
                    w.callback = function (...args) {
                        const v = orig ? orig.apply(this, args) : undefined;
                        setTimeout(() => applyAllStates(node), 0);
                        return v;
                    };
                }
            }

            setTimeout(() => applyAllStates(node), 50);
            return r;
        };

        // 载入旧工作流时也要恢复灰显状态
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;
            const node = this;
            setTimeout(() => applyAllStates(node), 50);
            return r;
        };
    },
});
