# -*- coding: utf-8 -*-
"""
LY Multi LoRA Loader (6)
一个 ComfyUI 节点：在一个节点里同时加载最多 6 个 LoRA。
每个槽位：LoRA 选择 + 启用开关（点击开/关）+ 类型（默认/风格/人物）+ 强度。
关闭的槽位不加载、不占显存，多个 LoRA 按槽位顺序叠加。
"""

import comfy.sd
import comfy.utils
import folder_paths

MAX_SLOTS = 6
EMPTY = "None"  # 下拉框里的空槽占位

LORA_TYPES = ["默认", "风格", "人物"]


def resolve_strength(lora_type, strength):
    """按 LoRA 类型决定模型强度 / 文本强度怎么给。

    默认：模型强度 = 文本强度 = 滑块值（通用做法）
    风格：文本强度 = 0（画风/质感类 LoRA 只作用于画面，不让它的触发词污染提示词）
    人物：文本强度 = 1.0（角色类 LoRA 需要文本侧满权重才能认出触发词、出对长相）
    """
    strength = float(strength)
    if lora_type == "风格":
        return strength, 0.0
    if lora_type == "人物":
        return strength, 1.0
    return strength, strength  # 默认


class LYMultiLoraLoader:
    CATEGORY = "LY/加载器"
    FUNCTION = "load_loras"
    RETURN_TYPES = ("MODEL", "CLIP", "STRING")
    RETURN_NAMES = ("model", "clip", "loaded_loras")
    DESCRIPTION = (
        "在一个节点里同时加载最多 6 个 LoRA。"
        "每个槽位：LoRA 选择 + 启用开关（点击开/关）+ 类型（默认/风格/人物）+ 强度。"
        "开关关闭的槽位会被跳过，不加载、不占显存。多个 LoRA 按槽位顺序叠加。"
        "类型说明：默认=模型与文本同强度；风格=文本强度取0，只影响画面；人物=文本强度固定1.0，保证角色触发词生效。"
    )

    @classmethod
    def INPUT_TYPES(cls):
        loras = [EMPTY] + folder_paths.get_filename_list("loras")
        required = {
            "model": ("MODEL",),
            "clip": ("CLIP",),
        }
        for i in range(1, MAX_SLOTS + 1):
            required.update({
                f"lora_{i}": (loras, {"default": EMPTY}),
                f"enable_{i}": ("BOOLEAN", {
                    "default": False,
                    "label_on": "启用",
                    "label_off": "关闭",
                }),
                f"type_{i}": (LORA_TYPES, {"default": "默认"}),
                f"strength_{i}": ("FLOAT", {
                    "default": 0.8, "min": -10.0, "max": 10.0, "step": 0.01,
                    "round": 0.01,
                }),
            })
        return {"required": required}

    def load_loras(self, model, clip, **kwargs):
        model_clone = model.clone()
        clip_clone = clip.clone()
        loaded = []

        for i in range(1, MAX_SLOTS + 1):
            # 开关关闭 → 直接跳过，不读文件不占显存
            if not kwargs.get(f"enable_{i}", False):
                continue

            name = kwargs.get(f"lora_{i}", EMPTY)
            if not name or name == EMPTY:
                continue

            path = folder_paths.get_full_path("loras", name)
            if not path:
                raise FileNotFoundError(
                    f"[LY Multi LoRA Loader] 在 models/loras 里找不到 LoRA 文件: {name}"
                )

            lora_type = kwargs.get(f"type_{i}", "默认")
            if lora_type not in LORA_TYPES:
                lora_type = "默认"
            model_strength, clip_strength = resolve_strength(
                lora_type, kwargs.get(f"strength_{i}", 0.8)
            )

            lora = comfy.utils.load_torch_file(path, safe_load=True)
            model_clone, clip_clone = comfy.sd.load_lora_for_models(
                model_clone,
                clip_clone,
                lora,
                model_strength,
                clip_strength,
            )
            loaded.append(
                f"{name} [{lora_type}] m:{model_strength:.2f} / c:{clip_strength:.2f}"
            )

        report = " + ".join(loaded) if loaded else "(没有启用任何 LoRA)"
        return (model_clone, clip_clone, report)


NODE_CLASS_MAPPINGS = {
    # 这个键是节点在系统里的"身份证号"，旧工作流靠它找回节点，不要改
    "LY Multi LoRA Loader (6)": LYMultiLoraLoader,
}

# 双击搜索框、节点标题栏显示的名字，这里用中文
NODE_DISPLAY_NAME_MAPPINGS = {
    "LY Multi LoRA Loader (6)": "LY-多lora加载",
}

# 前端增强脚本目录（中文标签、关闭槽位变灰、开启空槽自动选 LoRA）
WEB_DIRECTORY = "./web"
