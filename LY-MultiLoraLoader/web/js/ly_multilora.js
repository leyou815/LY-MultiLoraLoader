// LY Multi LoRA Loader (6) — 前端增强
// 1) 给每个槽位的控件加上中文标签
// 2) 开关关闭时，该槽位变灰且不可点
// 3) 打开一个还没选 LoRA 的空槽时，自动帮你选中列表里的第一个 LoRA
// 4) 切到「风格」类型时提示一下：文本强度会被自动置 0（纯画面生效，不污染提示词）

import { app } from "../../scripts/app.js";

const NODE_NAME = "LY Multi LoRA Loader (6)";
const SLOTS = 6;

const TYPE_HINT = {
    默认: "默认：模型与文本同强度",
    风格: "风格：文本强度自动置 0，只改画面",
    人物: "人物：文本强度固定 1.0，保证触发词生效",
};

function findWidget(node, name) {
    return (node.widgets || []).find((w) => w.name === name);
}

function slotWidgets(node, i) {
    return {
        enable: findWidget(node, `enable_${i}`),
        lora: findWidget(node, `lora_${i}`),
        type: findWidget(node, `type_${i}`),
        strength: findWidget(node, `strength_${i}`),
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
    // 画布类控件没有 element，就用标签后缀做视觉提示
    for (const [w, base] of [
        [lora, `LoRA ${i}`],
        [type, `LoRA ${i} 类型`],
        [strength, `LoRA ${i} 强度`],
    ]) {
        if (!w) continue;
        w.label = base + (on ? "" : "（已关闭）");
    }
}

function applyAllStates(node) {
    for (let i = 1; i <= SLOTS; i++) {
        const en = findWidget(node, `enable_${i}`);
        if (!en) continue;
        const on = !!en.value;
        setSlotEnabled(node, i, on);

        if (on) {
            // 打开空槽 → 自动选中第一个真实 LoRA
            const loraW = findWidget(node, `lora_${i}`);
            if (loraW && (loraW.value === "None" || loraW.value == null)) {
                const options = (loraW.options && loraW.options.values) || [];
                const first = options.find((v) => v !== "None");
                if (first) loraW.value = first;
            }
            // 类型提示挂在类型控件的 tooltip 上
            const typeW = findWidget(node, `type_${i}`);
            if (typeW && TYPE_HINT[typeW.value]) {
                typeW.tooltip = TYPE_HINT[typeW.value];
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

            // 中文标签
            for (let i = 1; i <= SLOTS; i++) {
                const { enable, lora, type, strength } = slotWidgets(this, i);
                if (enable) enable.label = `LoRA ${i} 启用开关`;
                if (lora) lora.label = `LoRA ${i}`;
                if (type) type.label = `LoRA ${i} 类型`;
                if (strength) strength.label = `LoRA ${i} 强度`;
            }

            // 开关 / 类型变化时刷新整组状态
            for (let i = 1; i <= SLOTS; i++) {
                for (const key of [`enable_${i}`, `type_${i}`]) {
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

            const node = this;
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
