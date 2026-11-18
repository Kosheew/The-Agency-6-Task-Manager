"""Генерує data/models.js — каталог 3D-ассетів гри для сторінки models.html.

Запуск (з кореня репозиторію менеджера задач):
    python tools/gen_assets.py "D:/Git/MyProjects/Agency-6-HDRP"

Скрипт лише читає список файлів у Assets/Content/Global/GameResources: моделі (FBX/OBJ),
анімації, префаби, матеріали, текстури, розміри. Самі бінарні файли на сайт не копіюються —
частина паків стороння (Asset Store), і їх не можна публікувати.
Також звіряє наявні моделі зі списком предметів із GDD (NEEDED нижче).
"""
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

# На якій глибині під GameResources починається окремий «пак»
PACK_DEPTH = {"Items": 3, "Characters": 2, "Healing Pack": 2, "Models": 2, "Props": 2, "VFX": 2, "HUD": 1, "Keypad": 1}
SKIP_TOP = {"Fonts", "HDRP Settings", "Materials", "Scenes", "Shaders", "Sounds"}
OWN = ("Models/Agency", "Models/Station")          # власні моделі команди

CATEGORY = [
    (r"^Characters/Animations", "Анімації"), (r"^Characters", "Персонажі"),
    (r"Ranged Weapons|Melee Weapons|Throwable", "Зброя"), (r"^Healing Pack|Survival|Other", "Предмети"),
    (r"^Models", "Локації"), (r"^Props", "Пропси"), (r"^Keypad", "Інтерактив"), (r"^VFX", "VFX"), (r"^HUD", "HUD"),
]

# Предмети й об'єкти з GDD → ключові слова для пошуку серед назв моделей
NEEDED = [
    ("Зброя", "Пістолет", r"pistol|glock|usp|handgun"),
    ("Зброя", "Гвинтівка / штурмова", r"^ar_[a-z]$|rifle|assault"),
    ("Зброя", "Дробовик", r"shotgun"),
    ("Зброя", "Пістолет-кулемет", r"smg|uzi|mp5"),
    ("Зброя", "Ніж / холодна зброя", r"knife|machete|sword|blade|melee"),
    ("Тактичні", "Граната", r"grenade|frag|m67"),
    ("Тактичні", "Димова шашка", r"smoke|m18"),
    ("Модулі", "Глушник", r"suppress|silenc"),
    ("Модулі", "Приціл", r"optic|scope|sight|holo|reddot"),
    ("Модулі", "Магазин", r"\bmag|magazine"),
    ("Медичні", "Аптечка", r"first ?aid|medkit|med_kit"),
    ("Медичні", "Стимулятор / шприц", r"syringe|stim|inject|spray"),
    ("Медичні", "Пігулки", r"pill"),
    ("Розслідування", "UV-ліхтар / ліхтарик", r"flashlight|torch|uv"),
    ("Розслідування", "Портативний комп'ютер", r"laptop|computer|terminal|pda"),
    ("Розслідування", "Фотокамера", r"\bcamera|polaroid"),
    ("Розслідування", "Лупа", r"magnif|loupe"),
    ("Доступ", "Відмичка", r"lockpick|lock_pick"),
    ("Доступ", "Ключі", r"^key\d*$|keyring|key tag"),
    ("Доступ", "Лом", r"crowbar"),
    ("Доступ", "Кодова панель", r"keypad"),
    ("Доступ", "Двері", r"door"),
    ("Сюжетні", "Документи / лист / фото", r"paper|document|letter|photo|folder"),
    ("Сюжетні", "Флешка / картка", r"usb|flash ?drive|keycard|card"),
    ("Технічні", "Рація", r"radio|walkie"),
    ("Технічні", "Телефон", r"phone"),
    ("Технічні", "Батарейки / акумулятор", r"batter"),
    ("Атмосферні", "Кава / чашка", r"coffee|cup|mug"),
    ("Атмосферні", "Цигарки / запальничка", r"cigar|lighter"),
    ("Атмосферні", "Їжа", r"food|sandwich|tuna|canned|ration"),
    ("Світ", "Ящики (руйнування)", r"crate|box"),
    ("Світ", "Хаб-станція", r"station"),
    ("Світ", "Офіс Агентства", r"agency"),
    ("Персонажі", "Агент (гравець)", r"agent|player|detective|characterdummy"),
    ("Персонажі", "Вороги / охорона", r"guard|enemy|soldier|bandit|characterdummy"),
    ("Персонажі", "Цивільні", r"civil|npc|citizen|characterdummy"),
]

NOISE = re.compile(r"bullet|ammo|case$|casing|shell|^rail_|^laser_|^light_", re.I)
# для самої зброї не рахуємо кріплення — вони окремі пункти «Модулі»
WEAPON_PARTS = re.compile(r"^muzzle|^optic|grip|bayonet|flash ?hider|stock|handguard", re.I)
PLACEHOLDER = re.compile(r"dummy|test|placeholder", re.I)
MESH_EXT = {".fbx", ".obj", ".blend", ".dae"}
TEX_EXT = {".png", ".tga", ".psd", ".jpg", ".jpeg", ".tif", ".tiff", ".exr"}


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python tools/gen_assets.py <path to Agency-6-HDRP>")
    game = Path(sys.argv[1])
    res = game / "Assets" / "Content" / "Global" / "GameResources"
    packs = {}
    for dirpath, _, files in os.walk(res):
        rel = Path(dirpath).relative_to(res)
        parts = rel.parts
        if not parts or parts[0] in SKIP_TOP:
            continue
        depth = PACK_DEPTH.get(parts[0], 1)
        key = "/".join(parts[:depth])
        p = packs.setdefault(key, {"pack": key, "meshes": [], "anims": 0, "prefabs": 0, "materials": 0, "textures": 0, "bytes": 0, "scenes": 0})
        is_anim_dir = "anim" in str(rel).lower()
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext == ".meta":
                continue
            try:
                p["bytes"] += os.path.getsize(os.path.join(dirpath, f))
            except OSError:
                pass
            if ext in MESH_EXT:
                if is_anim_dir or re.search(r"anim|@", f, re.I):
                    p["anims"] += 1
                else:
                    p["meshes"].append(os.path.splitext(f)[0])
            elif ext == ".prefab":
                p["prefabs"] += 1
            elif ext == ".mat":
                p["materials"] += 1
            elif ext in TEX_EXT:
                p["textures"] += 1
            elif ext == ".unity":
                p["scenes"] += 1

    out = []
    for key, p in sorted(packs.items()):
        if not (p["meshes"] or p["anims"] or p["prefabs"]):
            continue
        cat = next((c for pat, c in CATEGORY if re.search(pat, key)), "Інше")
        p["category"] = cat
        p["own"] = key.startswith(OWN)
        p["name"] = key.split("/")[-1]
        p["meshCount"] = len(p["meshes"])
        p["meshes"] = sorted(set(p["meshes"]))[:60]
        p["sizeMB"] = round(p.pop("bytes") / 1048576, 1)
        out.append(p)

    # Звірка з GDD
    needed = []
    for group, label, pattern in NEEDED:
        rx = re.compile(pattern, re.I)
        hits = []
        for p in out:
            if p["category"] == "Анімації":
                continue
            # набої, гільзи й кріплення не рахуються як сам предмет
            names = [m for m in p["meshes"] if rx.search(m) and not NOISE.search(m)
                     and not (group == "Зброя" and WEAPON_PARTS.search(m))]
            pack_hit = rx.search(p["pack"]) and not (group == "Зброя" and not names and p["meshCount"] == 0)
            if names or pack_hit:
                hits.append({"pack": p["pack"], "names": names[:6]})
        mesh_names = [n for h in hits for n in h["names"]]
        status = ("missing" if not hits
                  else "placeholder" if mesh_names and all(PLACEHOLDER.search(n) for n in mesh_names)
                  else "found")
        needed.append({"group": group, "item": label, "found": hits[:4], "status": status})

    payload = {"generated": date.today().isoformat(), "packs": out, "needed": needed}
    dst = Path(__file__).resolve().parent.parent / "data" / "models.js"
    dst.write_text("// Згенеровано tools/gen_assets.py — не редагуйте вручну.\nwindow.MODELS = "
                   + json.dumps(payload, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    have = sum(1 for n in needed if n["status"] == "found")
    print(f"{len(out)} packs, {sum(p['meshCount'] for p in out)} meshes; GDD items covered {have}/{len(needed)} -> {dst}")


if __name__ == "__main__":
    main()
