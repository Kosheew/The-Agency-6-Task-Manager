"""Генерує data/audio.js — каталог звуку гри для сторінки sound.html.

Запуск (з кореня репозиторію менеджера задач):
    python tools/gen_audio.py "D:/Git/MyProjects/Agency-6-HDRP"

Скрипт лише читає список аудіофайлів у Assets (без Plugins): паки, кількість, розмір,
тривалість WAV (із заголовка), канали мікшера з AudioChannel.cs. Самі файли на сайт
не копіюються — частина паків стороння. Також звіряє звуки з потребами гри (NEEDED).
"""
import json
import os
import re
import sys
import wave
from datetime import date
from pathlib import Path

AUDIO_EXT = {".wav", ".ogg", ".mp3", ".aif", ".aiff", ".flac"}

CATEGORY = [
    (r"music", "Музика"), (r"weapon|guns? audio|komposite", "Зброя"), (r"door", "Двері й меблі"),
    (r"footstep", "Кроки"), (r"/hud|/gui|keypad", "UI та інтерфейс"), (r"voice|dialog|vo_", "Голос"),
    (r"amb", "Амбієнт"), (r"sfx|items|aegis", "SFX"),
]
THIRD_PARTY = r"pack|free|komposite|aegis|footsteps v_|guns audios"

# Потрібні звуки за GDD і механіками → ключові слова для пошуку в назвах файлів
NEEDED = [
    ("Бій", "Постріл пістолета", r"pistol|handgun|9mm"),
    ("Бій", "Постріл гвинтівки / автомата", r"rifle|\bar\b|assault|auto"),
    ("Бій", "Постріл дробовика", r"shotgun"),
    ("Бій", "Постріл із глушником", r"silenc|suppress"),
    ("Бій", "Перезарядка", r"reload|mag(azine)?[_ ]?(in|out)|clip"),
    ("Бій", "Порожній магазин (клац)", r"dry|empty"),
    ("Бій", "Вибух гранати", r"explo|grenade|blast"),
    ("Бій", "Димова шашка", r"smoke|hiss"),
    ("Бій", "Удар ножем / ближній бій", r"knife|\bstab\b|_stab_|slash|melee|swing|(?<!click_)punch"),
    ("Бій", "Влучання в тіло / поранення", r"impact|hit|flesh|hurt|pain"),
    ("Персонаж", "Кроки (різні поверхні)", r"footstep|step"),
    ("Персонаж", "Серцебиття (стрес / низьке HP)", r"heart"),
    ("Персонаж", "Важке дихання (виснаження)", r"breath|pant"),
    ("Персонаж", "Шепіт / галюцинації (стрес)", r"whisper|halluc|voices"),
    ("Взаємодія", "Двері відкрити / закрити", r"door"),
    ("Взаємодія", "Шухляди, шафи, ящики", r"drawer|cabinet|box|chest|locker"),
    ("Взаємодія", "Кодова панель (піки)", r"keypad|beep"),
    ("Взаємодія", "Злам замка", r"lock_?pick|unlock|lock_rattle|tumbler"),
    ("Взаємодія", "Підбір предмета / доказу", r"pick ?up|pickup|collect|evidence|item"),
    ("Взаємодія", "Аптечка / лікування", r"heal|medkit|bandage|syringe"),
    ("Взаємодія", "Автомат з продажу / покупка", r"vend|coin|purchase|cash"),
    ("Інтерфейс", "Кліки й наведення в UI", r"ui|click|hover|button"),
    ("Інтерфейс", "Друк тексту в діалозі", r"typ(e|ing)|typewriter|keystroke"),
    ("Інтерфейс", "Сповіщення / новий квест", r"notif|quest|alert|objective"),
    ("Інтерфейс", "Тривога «Trespassing»", r"alarm|siren|trespass|warning"),
    ("Голос", "Озвучка діалогів (VO)", r"^vo_|voice|dialog"),
    ("Амбієнт", "Станція / вокзал", r"station|train|rail"),
    ("Амбієнт", "Хол готелю / інтер'єр", r"hotel|lobby|interior|room tone|roomtone"),
    ("Амбієнт", "Місто, дощ, ніч", r"city|rain|night|traffic|(?<!_)street(?!_tail)"),
    ("Музика", "Меню", r"menu|title|main"),
    ("Музика", "Дослідження (спокій)", r"explor|calm|ambient|chill"),
    ("Музика", "Напруга / стелс", r"tension|stealth|suspense"),
    ("Музика", "Бій", r"combat|battle|fight|action"),
]


def wav_seconds(path):
    try:
        with wave.open(str(path), "rb") as w:
            return w.getnframes() / float(w.getframerate() or 1)
    except Exception:
        return None


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python tools/gen_audio.py <path to Agency-6-HDRP>")
    game = Path(sys.argv[1])
    assets = game / "Assets"
    packs = {}
    for dirpath, _, files in os.walk(assets):
        rel = Path(dirpath).relative_to(assets)
        if rel.parts and rel.parts[0] == "Plugins":
            continue
        audio = [f for f in files if os.path.splitext(f)[1].lower() in AUDIO_EXT]
        if not audio:
            continue
        parts = rel.parts
        # Пак: тека після «Sounds», інакше — модуль/тека, де лежать файли
        if "Sounds" in parts:
            i = parts.index("Sounds")
            # SFX — збірна тека: ділимо на підпаки (Footsteps, GUI, Guns Audios)
            depth = i + 3 if len(parts) > i + 2 and parts[i + 1] == "SFX" else i + 2
            key = "/".join(parts[:depth])
        else:
            key = "/".join(parts[:4])
        p = packs.setdefault(key, {"pack": key, "files": [], "bytes": 0, "seconds": 0.0, "formats": {}})
        for f in audio:
            fp = Path(dirpath) / f
            ext = fp.suffix.lower().lstrip(".")
            p["formats"][ext] = p["formats"].get(ext, 0) + 1
            p["bytes"] += fp.stat().st_size
            sec = wav_seconds(fp) if ext == "wav" else None
            if sec:
                p["seconds"] += sec
            p["files"].append(fp.stem)

    out = []
    for key, p in sorted(packs.items()):
        name = key.split("/")[-1]
        cat = next((c for pat, c in CATEGORY if re.search(pat, key, re.I)), "Інше")
        out.append({
            "pack": key, "name": name, "category": cat,
            "count": len(p["files"]), "files": sorted(p["files"])[:80],
            "sizeMB": round(p["bytes"] / 1048576, 1), "minutes": round(p["seconds"] / 60, 1),
            "formats": p["formats"], "own": not re.search(THIRD_PARTY, key, re.I),
        })

    needed = []
    for group, label, pattern in NEEDED:
        rx = re.compile(pattern, re.I)
        hits = []
        for p in out:
            # музичні потреби шукаємо лише в музичних паках, решту — поза ними
            if (group == "Музика") != (p["category"] == "Музика"):
                continue
            names = [f for f in p["files"] if rx.search(f)]
            if names:
                hits.append({"pack": p["pack"], "names": names[:5], "count": len(names)})
        needed.append({"group": group, "item": label, "found": hits[:3], "status": "found" if hits else "missing"})

    channels = []
    ch = assets / "Core" / "AudioModule" / "Scripts" / "AudioChannel.cs"
    if ch.exists():
        src = ch.read_text(encoding="utf-8-sig", errors="ignore")
        body = re.search(r"enum\s+AudioChannel\s*\{([^}]*)\}", src)
        if body:
            channels = [c.strip() for c in body.group(1).split(",") if c.strip()]

    payload = {"generated": date.today().isoformat(), "packs": out, "needed": needed, "channels": channels}
    dst = Path(__file__).resolve().parent.parent / "data" / "audio.js"
    dst.write_text("// Згенеровано tools/gen_audio.py — не редагуйте вручну.\nwindow.AUDIO = "
                   + json.dumps(payload, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    have = sum(1 for n in needed if n["status"] == "found")
    print(f"{len(out)} packs, {sum(p['count'] for p in out)} files; needs covered {have}/{len(needed)}; channels {channels} -> {dst}")


if __name__ == "__main__":
    main()
