"""Генерує data/modules.js — документацію модулів гри для сторінки modules.html.

Запуск (з кореня репозиторію менеджера задач):
    python tools/gen_modules.py "D:/Git/MyProjects/Agency-6-HDRP"

Скрипт лише читає .cs-файли гри: неймспейси, інтерфейси, інсталери Zenject,
ScriptableObject-конфіги і залежності між модулями (за using). Опис призначення
модуля береться з DESCRIPTIONS нижче — доповнюйте його, коли з'являються нові модулі.
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

DESCRIPTIONS = {
    # Core
    "AssetLoaderModule": "Завантаження ассетів через Addressables з кешем і звільненням.",
    "AudioModule": "Музика, ефекти, озвучка діалогів, гучність і її збереження.",
    "BootstrapLoaderModule": "Редакторський інструмент: запуск гри з BootstrapScene з будь-якої сцени.",
    "CustomCodeGeneratorModule": "Генерація коду (константи, ключі) з налаштувань у редакторі.",
    "DialogueToolModule": "Графовий редактор діалогів у Unity (вузли, гілки, варіанти).",
    "EditorToolsModule": "Допоміжні атрибути й інструменти для інспектора.",
    "FSMModule": "Загальна скінченна машина станів для сутностей і систем.",
    "GameFlowStateMachineModule": "Глобальний потік гри: меню, завантаження, геймплей, пауза, діалог, game over.",
    "IKModule": "Inverse kinematics рук і зброї.",
    "InitializationModule": "Порядок ініціалізації сцени, сигнал «завантаження завершено».",
    "InputModule": "Нова Input System: карти дій гравця, обробники вводу.",
    "LoggerModule": "Логування з каналами (DebugChannel) і налаштуванням у редакторі.",
    "PoolModule": "Пули об'єктів для куль, ефектів, предметів.",
    "SaveModule": "JSON-збереження за ключами, реєстр категорій, редакторські інструменти скидання.",
    "SceneLoaderServiceModule": "Асинхронне завантаження й вивантаження сцен.",
    "SourceGeneratorModule": "Редакторські генератори коду.",
    # Features
    "CameraModule": "Камера Cinemachine, що слідує за гравцем.",
    "CoverModule": "Укриття: пошук точок, притискання до стіни.",
    "DialogueModule": "Діалоги з NPC: гілки, історія, варіанти з умовами, покупки, озвучка, ефект друку.",
    "EconomyModule": "Покупки за кредити: пропозиції, автомати, покупки з діалогу.",
    "EntityActionModule": "Стани дій сутностей: рух, погоня, атака, пошук.",
    "EntityAnimatorModule": "Аніматор сутностей і синхронізація зі станами.",
    "EntityAwarenessModule": "Поведінка AI: спокій, тривога, агресія, пошук.",
    "EntityModule": "Базова сутність (гравець, вороги, цивільні), конфіги, спавн, обробники.",
    "HandModule": "Руки сутностей: що тримають і як використовують.",
    "PathModule": "Маршрути патрулювання і навігація.",
    "VisionModule": "Зір AI: конус огляду і перевірка видимості.",
    "EvidenceModule": "Докази: збір, розкриття (Revealable), список і деталі, зв'язок зі стресом.",
    "FootstepModule": "Звуки кроків за типом поверхні.",
    "GameEventModule": "Канали подій (ScriptableObject) для зв'язку систем без прямих залежностей.",
    "InteractableModule": "Взаємодія з об'єктами і NPC, підказки та відгук.",
    "Combat": "Спільна бойова логіка предметів: урон, трасери, декалі.",
    "Core": "Ядро предметів: Item, контекст, фабрики, міцність, відображення стеків.",
    "InvestigationTool": "Інструменти розслідування в руці (ліхтар тощо), витрата витривалості.",
    "MedItem": "Медичні предмети і лікування.",
    "ModularWeapon": "Модулі зброї та їхні бонуси до характеристик.",
    "Spread": "Розкид при стрільбі та його відновлення.",
    "Throwable": "Метальні предмети: прицілювання, траєкторія, вибух.",
    "WeaponSystem": "Вогнепальна зброя: стрільба, набої, перезарядка, приціл, модифікатори.",
    "LocationModule": "Локації, їх стан і реєстр, переходи між ними.",
    "LootModule": "Лут на рівнях, збір і збереження прогресу збору.",
    "NoiseModule": "Шум від дій гравця і реакція слухачів.",
    "Data": "Дані гравця: позиція та трансформ.",
    "Hand": "Руки гравця: екіпірування, ввід, дворучна зброя.",
    "Health": "Здоров'я гравця та його відображення.",
    "Personality": "Психотип гравця: очки, домінантний тип, налаштування.",
    "Stats": "Ресурси гравця: здоров'я, витривалість, стрес.",
    "Storage": "Інвентар гравця і його збереження.",
    "Wallet": "Гаманець (кредити) і його збереження.",
    "PrefabFactoryModule": "Фабрики створення префабів через DI.",
    "QuestModule": "Квести: кроки на подіях, зони-тригери, UI квестів, редактор.",
    "ScreenModule": "Екрани UI: відкриття/закриття, кнопки, сповіщення, досьє.",
    "StatsModule": "Обмежені ресурси (база MonoBoundedStat): здоров'я, витривалість, стрес.",
    "SlotModule": "Слоти інвентарю: перетягування, відображення.",
    "StorageModule": "Сховище предметів (стандартне), набої в резерві.",
}

# Які задачі дошки стосуються модуля (за назвою)
TASKS = {
    "SaveModule": ["BUG-04", "BUG-05", "BUG-19", "AG-002"],
    "DialogueModule": ["BUG-01", "BUG-02", "BUG-03", "BUG-07", "BUG-13", "AG-016", "AG-017", "AG-018", "AG-022"],
    "QuestModule": ["BUG-06", "BUG-20", "AG-040", "AG-041"],
    "WeaponSystem": ["BUG-09", "BUG-15", "BUG-16", "BUG-17", "AG-025", "AG-029"],
    "ModularWeapon": ["BUG-12", "AG-026", "AG-027", "AG-028"],
    "Throwable": ["BUG-11"],
    "LootModule": ["BUG-10"],
    "Storage": ["BUG-08", "AG-032"],
    "SlotModule": ["BUG-18"],
    "ScreenModule": ["BUG-02", "AG-021"],
    "InputModule": ["BUG-03"],
    "GameFlowStateMachineModule": ["BUG-22"],
    "EntityActionModule": ["BUG-21"],
    "VisionModule": ["AG-034", "AG-035"],
    "Stats": ["AG-006", "AG-007", "AG-008"],
    "StatsModule": ["AG-006", "BUG-23"],
    "Personality": ["AG-012", "AG-013"],
    "Wallet": ["BUG-05", "BUG-19"],
    "EconomyModule": ["AG-042", "AG-043"],
    "NoiseModule": ["BUG-14"],
}


def module_dirs(root: Path):
    """Модулі: Core/<X>, Features/<X>, а для тек *System — їхні підмодулі."""
    core, feats = root / "Assets" / "Core", root / "Assets" / "Content" / "Features"
    for d in sorted(p for p in core.iterdir() if p.is_dir()):
        yield "Core", None, d
    for d in sorted(p for p in feats.iterdir() if p.is_dir()):
        subs = [s for s in d.iterdir() if s.is_dir() and any(s.rglob("*.cs"))]
        if d.name.endswith("System") and subs and not (d / "Scripts").exists():
            for s in sorted(subs):
                yield "Features", d.name, s
        else:
            yield "Features", None, d


def scan(path: Path):
    files = [f for f in path.rglob("*.cs")]
    ns, ifaces, installers, configs, usings, editor = set(), [], [], [], set(), 0
    for f in files:
        try:
            src = f.read_text(encoding="utf-8-sig", errors="ignore")
        except OSError:
            continue
        if "Editor" in f.parts:
            editor += 1
        ns.update(re.findall(r"^\s*namespace\s+([\w.]+)", src, re.M))
        usings.update(re.findall(r"^\s*using\s+([\w.]+)\s*;", src, re.M))
        ifaces += re.findall(r"public\s+interface\s+(I\w+)", src)
        installers += re.findall(r"class\s+(\w+Installer)\b", src)
        if "ScriptableObject" in src or "CreateAssetMenu" in src:
            configs += re.findall(r"class\s+(\w+)\s*:\s*(?:ScriptableObject|\w*Configuration\b)", src)
    return files, sorted(ns), sorted(set(ifaces)), sorted(set(installers)), sorted(set(configs)), usings, editor


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python tools/gen_modules.py <path to Agency-6-HDRP>")
    root = Path(sys.argv[1])
    raw = []
    for layer, group, d in module_dirs(root):
        files, ns, ifaces, inst, cfgs, usings, editor = scan(d)
        if not files:
            continue
        raw.append(dict(name=d.name, layer=layer, group=group, path=str(d.relative_to(root / "Assets")).replace("\\", "/"),
                        files=len(files), editorFiles=editor, namespaces=ns, interfaces=ifaces,
                        installers=inst, configs=cfgs, _usings=usings))

    # залежності: модуль A використовує неймспейс, що належить модулю B
    owner = {}
    for m in raw:
        for n in m["namespaces"]:
            owner.setdefault(n, m["name"])
    for m in raw:
        deps = set()
        for u in m.pop("_usings"):
            o = owner.get(u)
            if o and o != m["name"]:
                deps.add(o)
        m["deps"] = sorted(deps)
        m["desc"] = DESCRIPTIONS.get(m["name"], "")
        m["tasks"] = TASKS.get(m["name"], [])
    for m in raw:
        m["usedBy"] = sorted(x["name"] for x in raw if m["name"] in x["deps"])

    out = Path(__file__).resolve().parent.parent / "data" / "modules.js"
    payload = {"generated": date.today().isoformat(), "modules": raw}
    out.write_text("// Згенеровано tools/gen_modules.py — не редагуйте вручну.\nwindow.MODULES = "
                   + json.dumps(payload, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    print(f"{len(raw)} modules -> {out}")


if __name__ == "__main__":
    main()
