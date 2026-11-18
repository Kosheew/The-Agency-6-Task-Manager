// Згенеровано tools/gen_modules.py — не редагуйте вручну.
window.MODULES = {
 "generated": "2026-11-18",
 "modules": [
  {
   "name": "AssetLoaderModule",
   "layer": "Core",
   "group": null,
   "path": "Core/AssetLoaderModule",
   "files": 11,
   "editorFiles": 0,
   "namespaces": [
    "Core.AssetLoaderModule.Core.Scripts"
   ],
   "interfaces": [
    "IAddressablesAssetLoaderService",
    "IAssetLoaderFacadeService",
    "IAssetLoaderService",
    "IResourceAssetLoaderService"
   ],
   "installers": [
    "AssetLoaderInstaller"
   ],
   "configs": [],
   "deps": [],
   "desc": "Завантаження ассетів через Addressables з кешем і звільненням.",
   "tasks": [],
   "usedBy": [
    "AudioModule",
    "DialogueModule",
    "EntityModule",
    "EvidenceModule",
    "FootstepModule",
    "GameEventModule",
    "GameFlowStateMachineModule",
    "InvestigationTool",
    "MedItem",
    "ModularWeapon",
    "PoolModule",
    "PrefabFactoryModule",
    "QuestModule",
    "Storage",
    "Throwable",
    "WeaponSystem"
   ]
  },
  {
   "name": "AudioModule",
   "layer": "Core",
   "group": null,
   "path": "Core/AudioModule",
   "files": 14,
   "editorFiles": 0,
   "namespaces": [
    "AudioModule"
   ],
   "interfaces": [
    "IAudioEmitter",
    "IAudioListenerController",
    "IAudioService",
    "IAudioVolumeService"
   ],
   "installers": [
    "AudioServiceInstaller"
   ],
   "configs": [
    "AudioConfigurations"
   ],
   "deps": [
    "AssetLoaderModule",
    "LoggerModule",
    "SaveModule"
   ],
   "desc": "Музика, ефекти, озвучка діалогів, гучність і її збереження.",
   "tasks": [],
   "usedBy": [
    "DialogueModule",
    "FootstepModule",
    "GameFlowStateMachineModule",
    "ScreenModule"
   ]
  },
  {
   "name": "BootstrapLoaderModule",
   "layer": "Core",
   "group": null,
   "path": "Core/BootstrapLoaderModule",
   "files": 1,
   "editorFiles": 1,
   "namespaces": [
    "Core.BootstrapLoaderModule.Scripts"
   ],
   "interfaces": [],
   "installers": [],
   "configs": [],
   "deps": [],
   "desc": "Редакторський інструмент: запуск гри з BootstrapScene з будь-якої сцени.",
   "tasks": [],
   "usedBy": []
  },
  {
   "name": "CustomCodeGeneratorModule",
   "layer": "Core",
   "group": null,
   "path": "Core/CustomCodeGeneratorModule",
   "files": 8,
   "editorFiles": 8,
   "namespaces": [
    "Core.CustomCodeGeneratorModule.Scripts.Editor",
    "Core.CustomCodeGeneratorModule.Scripts.Editor.Core",
    "Core.CustomCodeGeneratorModule.Scripts.Editor.Settings",
    "Core.CustomCodeGeneratorModule.Scripts.Editor.Utils"
   ],
   "interfaces": [
    "ICodeGenerator"
   ],
   "installers": [],
   "configs": [],
   "deps": [],
   "desc": "Генерація коду (константи, ключі) з налаштувань у редакторі.",
   "tasks": [],
   "usedBy": [
    "SourceGeneratorModule"
   ]
  },
  {
   "name": "DialogueToolModule",
   "layer": "Core",
   "group": null,
   "path": "Core/DialogueToolModule",
   "files": 9,
   "editorFiles": 9,
   "namespaces": [],
   "interfaces": [
    "IDialogueNode"
   ],
   "installers": [],
   "configs": [
    "DialogueDatabase"
   ],
   "deps": [
    "DialogueModule",
    "GameEventModule"
   ],
   "desc": "Графовий редактор діалогів у Unity (вузли, гілки, варіанти).",
   "tasks": [],
   "usedBy": []
  },
  {
   "name": "EditorToolsModule",
   "layer": "Core",
   "group": null,
   "path": "Core/EditorToolsModule",
   "files": 5,
   "editorFiles": 3,
   "namespaces": [
    "Agency6.Editor"
   ],
   "interfaces": [],
   "installers": [],
   "configs": [],
   "deps": [],
   "desc": "Допоміжні атрибути й інструменти для інспектора.",
   "tasks": [],
   "usedBy": []
  },
  {
   "name": "FSMModule",
   "layer": "Core",
   "group": null,
   "path": "Core/FSMModule",
   "files": 4,
   "editorFiles": 0,
   "namespaces": [
    "Core.FSMModule.Scripts"
   ],
   "interfaces": [
    "IFiniteStateMachine",
    "IState"
   ],
   "installers": [
    "FSMInstaller"
   ],
   "configs": [],
   "deps": [
    "EntityActionModule",
    "EntityAwarenessModule"
   ],
   "desc": "Загальна скінченна машина станів для сутностей і систем.",
   "tasks": [],
   "usedBy": [
    "EntityActionModule",
    "EntityAwarenessModule",
    "EntityModule",
    "GameFlowStateMachineModule",
    "InteractableModule"
   ]
  },
  {
   "name": "GameFlowStateMachineModule",
   "layer": "Core",
   "group": null,
   "path": "Core/GameFlowStateMachineModule",
   "files": 18,
   "editorFiles": 0,
   "namespaces": [
    "GameBootstrapModule.Bootstraps",
    "GameBootstrapModule.ProjectDI",
    "GameFlowService"
   ],
   "interfaces": [
    "IPayloadedState"
   ],
   "installers": [
    "GameFlowStateMachineInstaller",
    "GameSceneContextInstaller",
    "MenuSceneContextInstaller",
    "ProjectContextInstaller"
   ],
   "configs": [
    "GameSceneContextInstaller",
    "MenuSceneContextInstaller",
    "ProjectContextInstaller"
   ],
   "deps": [
    "AssetLoaderModule",
    "AudioModule",
    "CameraModule",
    "Core",
    "Data",
    "DialogueModule",
    "EconomyModule",
    "EntityModule",
    "EvidenceModule",
    "FSMModule",
    "GameEventModule",
    "Hand",
    "Health",
    "InitializationModule",
    "InvestigationTool",
    "LocationModule",
    "LoggerModule",
    "LootModule",
    "MedItem",
    "ModularWeapon",
    "PathModule",
    "Personality",
    "PoolModule",
    "PrefabFactoryModule",
    "QuestModule",
    "SceneLoaderServiceModule",
    "Spread",
    "Stats",
    "Storage",
    "StorageModule",
    "Throwable",
    "Wallet",
    "WeaponSystem"
   ],
   "desc": "Глобальний потік гри: меню, завантаження, геймплей, пауза, діалог, game over.",
   "tasks": [
    "BUG-22"
   ],
   "usedBy": []
  },
  {
   "name": "IKModule",
   "layer": "Core",
   "group": null,
   "path": "Core/IKModule",
   "files": 3,
   "editorFiles": 1,
   "namespaces": [
    "Core.IKModule.Scripts"
   ],
   "interfaces": [],
   "installers": [],
   "configs": [],
   "deps": [],
   "desc": "Inverse kinematics рук і зброї.",
   "tasks": [],
   "usedBy": []
  },
  {
   "name": "InitializationModule",
   "layer": "Core",
   "group": null,
   "path": "Core/InitializationModule",
   "files": 2,
   "editorFiles": 0,
   "namespaces": [
    "InitializationService"
   ],
   "interfaces": [
    "ICustomInitializable"
   ],
   "installers": [],
   "configs": [],
   "deps": [
    "LoggerModule",
    "SceneLoaderServiceModule"
   ],
   "desc": "Порядок ініціалізації сцени, сигнал «завантаження завершено».",
   "tasks": [],
   "usedBy": [
    "CameraModule",
    "EntityModule",
    "GameFlowStateMachineModule",
    "PoolModule",
    "PrefabFactoryModule",
    "ScreenModule"
   ]
  },
  {
   "name": "InputModule",
   "layer": "Core",
   "group": null,
   "path": "Core/InputModule",
   "files": 10,
   "editorFiles": 0,
   "namespaces": [
    "Core.InputModule.Generated",
    "InputModule"
   ],
   "interfaces": [
    "IPlayerActions",
    "IPlayerInputListener",
    "ISystemActions",
    "ISystemInputListener",
    "IUIActions",
    "IUIInputListener"
   ],
   "installers": [
    "InputInstaller"
   ],
   "configs": [
    "InputInstaller"
   ],
   "deps": [
    "LoggerModule"
   ],
   "desc": "Нова Input System: карти дій гравця, обробники вводу.",
   "tasks": [
    "BUG-03"
   ],
   "usedBy": [
    "EntityModule",
    "Hand",
    "Throwable",
    "WeaponSystem"
   ]
  },
  {
   "name": "LoggerModule",
   "layer": "Core",
   "group": null,
   "path": "Core/LoggerModule",
   "files": 4,
   "editorFiles": 2,
   "namespaces": [
    "Agency6.Editor",
    "Tools"
   ],
   "interfaces": [],
   "installers": [],
   "configs": [],
   "deps": [],
   "desc": "Логування з каналами (DebugChannel) і налаштуванням у редакторі.",
   "tasks": [],
   "usedBy": [
    "AudioModule",
    "Combat",
    "Core",
    "CoverModule",
    "DialogueModule",
    "EconomyModule",
    "EntityActionModule",
    "EntityAwarenessModule",
    "EntityModule",
    "EvidenceModule",
    "FootstepModule",
    "GameEventModule",
    "GameFlowStateMachineModule",
    "Hand",
    "HandModule",
    "InitializationModule",
    "InputModule",
    "InteractableModule",
    "InvestigationTool",
    "LootModule",
    "PathModule",
    "QuestModule",
    "SaveModule",
    "SceneLoaderServiceModule",
    "ScreenModule",
    "Stats",
    "StatsModule",
    "Throwable",
    "Wallet",
    "WeaponSystem"
   ]
  },
  {
   "name": "PoolModule",
   "layer": "Core",
   "group": null,
   "path": "Core/PoolModule",
   "files": 8,
   "editorFiles": 0,
   "namespaces": [
    "PoolModule"
   ],
   "interfaces": [
    "IPoolService"
   ],
   "installers": [
    "PoolInstaller"
   ],
   "configs": [
    "PoolEntry",
    "PoolsConfiguration"
   ],
   "deps": [
    "AssetLoaderModule",
    "InitializationModule"
   ],
   "desc": "Пули об'єктів для куль, ефектів, предметів.",
   "tasks": [],
   "usedBy": [
    "DialogueModule",
    "EvidenceModule",
    "GameFlowStateMachineModule",
    "Hand",
    "QuestModule",
    "ScreenModule",
    "SlotModule",
    "Storage",
    "WeaponSystem"
   ]
  },
  {
   "name": "SaveModule",
   "layer": "Core",
   "group": null,
   "path": "Core/SaveModule",
   "files": 9,
   "editorFiles": 1,
   "namespaces": [
    "Agency6.Editor",
    "SaveServices"
   ],
   "interfaces": [
    "ISaveRegistry",
    "ISaveService",
    "IValidatable"
   ],
   "installers": [
    "SaveServiceInstaller"
   ],
   "configs": [
    "SaveServiceInstaller"
   ],
   "deps": [
    "LoggerModule"
   ],
   "desc": "JSON-збереження за ключами, реєстр категорій, редакторські інструменти скидання.",
   "tasks": [
    "BUG-04",
    "BUG-05",
    "BUG-19",
    "AG-002"
   ],
   "usedBy": [
    "AudioModule",
    "DialogueModule",
    "EvidenceModule",
    "LootModule",
    "Storage",
    "Wallet"
   ]
  },
  {
   "name": "SceneLoaderServiceModule",
   "layer": "Core",
   "group": null,
   "path": "Core/SceneLoaderServiceModule",
   "files": 5,
   "editorFiles": 0,
   "namespaces": [
    "SceneLoaderService"
   ],
   "interfaces": [
    "ILoadingProgressService",
    "ISceneLoader"
   ],
   "installers": [
    "SceneLoaderInstaller"
   ],
   "configs": [],
   "deps": [
    "LoggerModule"
   ],
   "desc": "Асинхронне завантаження й вивантаження сцен.",
   "tasks": [],
   "usedBy": [
    "GameFlowStateMachineModule",
    "InitializationModule",
    "LocationModule"
   ]
  },
  {
   "name": "SourceGeneratorModule",
   "layer": "Core",
   "group": null,
   "path": "Core/SourceGeneratorModule",
   "files": 12,
   "editorFiles": 12,
   "namespaces": [
    "Core.SourceGeneratorModule.Scripts.Generators",
    "Core.SourceGeneratorModule.Scripts.Tools"
   ],
   "interfaces": [],
   "installers": [],
   "configs": [],
   "deps": [
    "CustomCodeGeneratorModule"
   ],
   "desc": "Редакторські генератори коду.",
   "tasks": [],
   "usedBy": []
  },
  {
   "name": "CameraModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/CameraModule",
   "files": 5,
   "editorFiles": 0,
   "namespaces": [
    "CameraModule"
   ],
   "interfaces": [],
   "installers": [
    "CameraInstaller"
   ],
   "configs": [],
   "deps": [
    "Data",
    "InitializationModule",
    "PrefabFactoryModule"
   ],
   "desc": "Камера Cinemachine, що слідує за гравцем.",
   "tasks": [],
   "usedBy": [
    "EntityModule",
    "GameFlowStateMachineModule",
    "InteractableModule",
    "Throwable"
   ]
  },
  {
   "name": "CoverModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/CoverModule",
   "files": 6,
   "editorFiles": 0,
   "namespaces": [
    "CoverModule"
   ],
   "interfaces": [
    "ICoverFinder",
    "ICoverPoint"
   ],
   "installers": [],
   "configs": [],
   "deps": [
    "LoggerModule"
   ],
   "desc": "Укриття: пошук точок, притискання до стіни.",
   "tasks": [],
   "usedBy": [
    "EntityModule"
   ]
  },
  {
   "name": "DialogueModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/DialogueModule",
   "files": 28,
   "editorFiles": 0,
   "namespaces": [
    "DialogueModule",
    "DialogueModule.Configurations",
    "DialogueModule.View"
   ],
   "interfaces": [
    "IDialogueModel",
    "IDialogueModelRegisterService",
    "IDialogueOptionMessageView",
    "IDialogueView"
   ],
   "installers": [
    "DialoguesInstaller"
   ],
   "configs": [
    "DialogueBranch",
    "DialogueNode",
    "DialogueParticipant",
    "DialogueUIConfiguration",
    "DialoguesConfigurations"
   ],
   "deps": [
    "AssetLoaderModule",
    "AudioModule",
    "EconomyModule",
    "EntityActionModule",
    "EvidenceModule",
    "GameEventModule",
    "InteractableModule",
    "LoggerModule",
    "Personality",
    "PoolModule",
    "SaveModule"
   ],
   "desc": "Діалоги з NPC: гілки, історія, варіанти з умовами, покупки, озвучка, ефект друку.",
   "tasks": [
    "BUG-01",
    "BUG-02",
    "BUG-03",
    "BUG-07",
    "BUG-13",
    "AG-016",
    "AG-017",
    "AG-018",
    "AG-022"
   ],
   "usedBy": [
    "DialogueToolModule",
    "EntityActionModule",
    "EvidenceModule",
    "GameFlowStateMachineModule",
    "InteractableModule",
    "InvestigationTool",
    "Personality",
    "ScreenModule"
   ]
  },
  {
   "name": "EconomyModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/EconomyModule",
   "files": 5,
   "editorFiles": 0,
   "namespaces": [
    "EconomyModule"
   ],
   "interfaces": [
    "IPurchaseService"
   ],
   "installers": [
    "EconomyInstaller"
   ],
   "configs": [
    "PurchaseOfferConfiguration"
   ],
   "deps": [
    "Core",
    "GameEventModule",
    "LoggerModule",
    "Storage",
    "Wallet"
   ],
   "desc": "Покупки за кредити: пропозиції, автомати, покупки з діалогу.",
   "tasks": [
    "AG-042",
    "AG-043"
   ],
   "usedBy": [
    "DialogueModule",
    "GameFlowStateMachineModule"
   ]
  },
  {
   "name": "EntityActionModule",
   "layer": "Features",
   "group": "EntitySystem",
   "path": "Content/Features/EntitySystem/EntityActionModule",
   "files": 16,
   "editorFiles": 0,
   "namespaces": [
    "EntityActionModule"
   ],
   "interfaces": [
    "IEntityStateFactory",
    "IEntityStateProvider"
   ],
   "installers": [],
   "configs": [],
   "deps": [
    "Combat",
    "DialogueModule",
    "EntityAwarenessModule",
    "EntityModule",
    "FSMModule",
    "InteractableModule",
    "LoggerModule",
    "LootModule"
   ],
   "desc": "Стани дій сутностей: рух, погоня, атака, пошук.",
   "tasks": [
    "BUG-21"
   ],
   "usedBy": [
    "DialogueModule",
    "EntityAwarenessModule",
    "EntityModule",
    "FSMModule",
    "InteractableModule"
   ]
  },
  {
   "name": "EntityAnimatorModule",
   "layer": "Features",
   "group": "EntitySystem",
   "path": "Content/Features/EntitySystem/EntityAnimatorModule",
   "files": 4,
   "editorFiles": 0,
   "namespaces": [
    "EntityAnimatorModule"
   ],
   "interfaces": [
    "IEntityAnimator"
   ],
   "installers": [],
   "configs": [],
   "deps": [],
   "desc": "Аніматор сутностей і синхронізація зі станами.",
   "tasks": [],
   "usedBy": [
    "EntityModule"
   ]
  },
  {
   "name": "EntityAwarenessModule",
   "layer": "Features",
   "group": "EntitySystem",
   "path": "Content/Features/EntitySystem/EntityAwarenessModule",
   "files": 12,
   "editorFiles": 0,
   "namespaces": [
    "EntityAwarenessModule"
   ],
   "interfaces": [
    "IEntityBehaviour",
    "IEntityBehaviourFactory",
    "IEntityBehaviourProvider"
   ],
   "installers": [],
   "configs": [],
   "deps": [
    "EntityActionModule",
    "EntityModule",
    "FSMModule",
    "LoggerModule",
    "VisionModule"
   ],
   "desc": "Поведінка AI: спокій, тривога, агресія, пошук.",
   "tasks": [],
   "usedBy": [
    "EntityActionModule",
    "EntityModule",
    "FSMModule",
    "InteractableModule"
   ]
  },
  {
   "name": "EntityModule",
   "layer": "Features",
   "group": "EntitySystem",
   "path": "Content/Features/EntitySystem/EntityModule",
   "files": 20,
   "editorFiles": 1,
   "namespaces": [
    "EntityModule",
    "EntityModule.Editor",
    "EntityModule.Spawning"
   ],
   "interfaces": [
    "IEntityDataService",
    "IEntityHandler"
   ],
   "installers": [
    "EntityInstaller"
   ],
   "configs": [
    "EntitiesConfiguration",
    "EntityConfiguration"
   ],
   "deps": [
    "AssetLoaderModule",
    "CameraModule",
    "Combat",
    "Core",
    "CoverModule",
    "EntityActionModule",
    "EntityAnimatorModule",
    "EntityAwarenessModule",
    "EvidenceModule",
    "FSMModule",
    "FootstepModule",
    "InitializationModule",
    "InputModule",
    "InteractableModule",
    "LoggerModule",
    "MedItem",
    "NoiseModule",
    "PathModule",
    "PrefabFactoryModule",
    "QuestModule",
    "Stats",
    "StatsModule",
    "StorageModule",
    "VisionModule",
    "WeaponSystem"
   ],
   "desc": "Базова сутність (гравець, вороги, цивільні), конфіги, спавн, обробники.",
   "tasks": [],
   "usedBy": [
    "EntityActionModule",
    "EntityAwarenessModule",
    "GameFlowStateMachineModule",
    "PathModule",
    "Stats",
    "StatsModule",
    "WeaponSystem"
   ]
  },
  {
   "name": "HandModule",
   "layer": "Features",
   "group": "EntitySystem",
   "path": "Content/Features/EntitySystem/HandModule",
   "files": 4,
   "editorFiles": 0,
   "namespaces": [
    "HandModule"
   ],
   "interfaces": [
    "IHand"
   ],
   "installers": [],
   "configs": [],
   "deps": [
    "Core",
    "LoggerModule"
   ],
   "desc": "Руки сутностей: що тримають і як використовують.",
   "tasks": [],
   "usedBy": [
    "Core",
    "Hand",
    "Storage"
   ]
  },
  {
   "name": "PathModule",
   "layer": "Features",
   "group": "EntitySystem",
   "path": "Content/Features/EntitySystem/PathModule",
   "files": 11,
   "editorFiles": 0,
   "namespaces": [
    "PathModule"
   ],
   "interfaces": [
    "IEntityCalculatePath",
    "IEntityDestinationHandler",
    "IEntityPatrolHandler",
    "IPatrolPathService"
   ],
   "installers": [
    "PathInstaller"
   ],
   "configs": [],
   "deps": [
    "EntityModule",
    "LoggerModule"
   ],
   "desc": "Маршрути патрулювання і навігація.",
   "tasks": [],
   "usedBy": [
    "EntityModule",
    "GameFlowStateMachineModule"
   ]
  },
  {
   "name": "VisionModule",
   "layer": "Features",
   "group": "EntitySystem",
   "path": "Content/Features/EntitySystem/VisionModule",
   "files": 3,
   "editorFiles": 1,
   "namespaces": [
    "VisionModule",
    "VisionModule.Editor"
   ],
   "interfaces": [
    "IEntityVision"
   ],
   "installers": [],
   "configs": [],
   "deps": [
    "Combat",
    "InteractableModule"
   ],
   "desc": "Зір AI: конус огляду і перевірка видимості.",
   "tasks": [
    "AG-034",
    "AG-035"
   ],
   "usedBy": [
    "EntityAwarenessModule",
    "EntityModule"
   ]
  },
  {
   "name": "EvidenceModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/EvidenceModule",
   "files": 24,
   "editorFiles": 1,
   "namespaces": [
    "EvidenceModule",
    "EvidenceModule.Editor",
    "ScreenModule"
   ],
   "interfaces": [
    "IEvidenceCollectionService",
    "IEvidenceDataService",
    "IEvidenceDetailsView",
    "IEvidenceListView",
    "IEvidenceView",
    "IRevealable",
    "IRevealableRegistry"
   ],
   "installers": [
    "EvidenceInstaller"
   ],
   "configs": [
    "EvidenceConfiguration",
    "EvidenceConfigurations"
   ],
   "deps": [
    "AssetLoaderModule",
    "DialogueModule",
    "InteractableModule",
    "LoggerModule",
    "LootModule",
    "Personality",
    "PoolModule",
    "SaveModule",
    "Stats"
   ],
   "desc": "Докази: збір, розкриття (Revealable), список і деталі, зв'язок зі стресом.",
   "tasks": [],
   "usedBy": [
    "Core",
    "DialogueModule",
    "EntityModule",
    "GameFlowStateMachineModule",
    "InteractableModule",
    "InvestigationTool",
    "QuestModule",
    "ScreenModule",
    "WeaponSystem"
   ]
  },
  {
   "name": "FootstepModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/FootstepModule",
   "files": 8,
   "editorFiles": 0,
   "namespaces": [
    "FootstepModule"
   ],
   "interfaces": [
    "IFootstepSoundHandler"
   ],
   "installers": [
    "FootstepInstaller"
   ],
   "configs": [
    "FootstepSoundConfigurations"
   ],
   "deps": [
    "AssetLoaderModule",
    "AudioModule",
    "LoggerModule"
   ],
   "desc": "Звуки кроків за типом поверхні.",
   "tasks": [],
   "usedBy": [
    "EntityModule"
   ]
  },
  {
   "name": "GameEventModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/GameEventModule",
   "files": 9,
   "editorFiles": 0,
   "namespaces": [
    "GameEventModule"
   ],
   "interfaces": [
    "IGameEventInvoker",
    "IGameEventService",
    "IZoneOverlapListener"
   ],
   "installers": [
    "GameEventInstaller"
   ],
   "configs": [
    "GameEventChannel",
    "GameEventChannels"
   ],
   "deps": [
    "AssetLoaderModule",
    "LoggerModule"
   ],
   "desc": "Канали подій (ScriptableObject) для зв'язку систем без прямих залежностей.",
   "tasks": [],
   "usedBy": [
    "DialogueModule",
    "DialogueToolModule",
    "EconomyModule",
    "GameFlowStateMachineModule",
    "InteractableModule",
    "QuestModule"
   ]
  },
  {
   "name": "InteractableModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/InteractableModule",
   "files": 17,
   "editorFiles": 0,
   "namespaces": [
    "InteractableModule",
    "InteractableModule.Feedback",
    "InteractableModule.Interactables"
   ],
   "interfaces": [
    "IFeedback",
    "IFeedbackFinder",
    "IInteractable",
    "IInteractableFinder",
    "IInteractor"
   ],
   "installers": [],
   "configs": [],
   "deps": [
    "CameraModule",
    "Combat",
    "DialogueModule",
    "EntityActionModule",
    "EntityAwarenessModule",
    "EvidenceModule",
    "FSMModule",
    "GameEventModule",
    "InvestigationTool",
    "LoggerModule",
    "LootModule"
   ],
   "desc": "Взаємодія з об'єктами і NPC, підказки та відгук.",
   "tasks": [],
   "usedBy": [
    "DialogueModule",
    "EntityActionModule",
    "EntityModule",
    "EvidenceModule",
    "LootModule",
    "VisionModule"
   ]
  },
  {
   "name": "Combat",
   "layer": "Features",
   "group": "ItemSystem",
   "path": "Content/Features/ItemSystem/Combat",
   "files": 7,
   "editorFiles": 0,
   "namespaces": [
    "ItemModule.Combat"
   ],
   "interfaces": [
    "IDamageCalculator",
    "IDamageable",
    "IDamageableResolver"
   ],
   "installers": [],
   "configs": [],
   "deps": [
    "LoggerModule",
    "StatsModule"
   ],
   "desc": "Спільна бойова логіка предметів: урон, трасери, декалі.",
   "tasks": [],
   "usedBy": [
    "Core",
    "EntityActionModule",
    "EntityModule",
    "InteractableModule",
    "Throwable",
    "VisionModule",
    "WeaponSystem"
   ]
  },
  {
   "name": "Core",
   "layer": "Features",
   "group": "ItemSystem",
   "path": "Content/Features/ItemSystem/Core",
   "files": 26,
   "editorFiles": 1,
   "namespaces": [
    "ItemModule",
    "ItemModule.Durability",
    "ItemModule.Editor",
    "ItemModule.Handler"
   ],
   "interfaces": [
    "IDurability",
    "IItemFactory",
    "IItemFactoryRegistry",
    "IItemStackFactory",
    "IItemStackView",
    "IUseItemHandler"
   ],
   "installers": [
    "ItemInstaller"
   ],
   "configs": [
    "ItemConfiguration"
   ],
   "deps": [
    "Combat",
    "EvidenceModule",
    "Hand",
    "HandModule",
    "InvestigationTool",
    "LoggerModule",
    "MedItem",
    "ModularWeapon",
    "PrefabFactoryModule",
    "SlotModule",
    "Spread",
    "StorageModule",
    "Throwable",
    "WeaponSystem"
   ],
   "desc": "Ядро предметів: Item, контекст, фабрики, міцність, відображення стеків.",
   "tasks": [],
   "usedBy": [
    "EconomyModule",
    "EntityModule",
    "GameFlowStateMachineModule",
    "Hand",
    "HandModule",
    "InvestigationTool",
    "LootModule",
    "MedItem",
    "ModularWeapon",
    "ScreenModule",
    "SlotModule",
    "Storage",
    "StorageModule",
    "Throwable",
    "WeaponSystem"
   ]
  },
  {
   "name": "InvestigationTool",
   "layer": "Features",
   "group": "ItemSystem",
   "path": "Content/Features/ItemSystem/InvestigationTool",
   "files": 10,
   "editorFiles": 0,
   "namespaces": [
    "ItemModule.InvestigationTool"
   ],
   "interfaces": [
    "IInvestigationToolDataService",
    "IInvestigationToolFactory"
   ],
   "installers": [
    "InvestigationToolInstaller"
   ],
   "configs": [
    "InvestigationToolConfiguration",
    "InvestigationToolConfigurations"
   ],
   "deps": [
    "AssetLoaderModule",
    "Core",
    "DialogueModule",
    "EvidenceModule",
    "LoggerModule",
    "Personality",
    "Stats",
    "StorageModule"
   ],
   "desc": "Інструменти розслідування в руці (ліхтар тощо), витрата витривалості.",
   "tasks": [],
   "usedBy": [
    "Core",
    "GameFlowStateMachineModule",
    "InteractableModule"
   ]
  },
  {
   "name": "MedItem",
   "layer": "Features",
   "group": "ItemSystem",
   "path": "Content/Features/ItemSystem/MedItem",
   "files": 14,
   "editorFiles": 0,
   "namespaces": [
    "ItemModule.MedItem",
    "ItemModule.MedItem.Healable"
   ],
   "interfaces": [
    "IHealable",
    "IHealableHandler",
    "IMedItemDataService",
    "IMedItemFactory"
   ],
   "installers": [
    "MedItemInstaller"
   ],
   "configs": [
    "MedItemConfiguration",
    "MedItemConfigurations"
   ],
   "deps": [
    "AssetLoaderModule",
    "Core",
    "StatsModule",
    "StorageModule"
   ],
   "desc": "Медичні предмети і лікування.",
   "tasks": [],
   "usedBy": [
    "Core",
    "EntityModule",
    "GameFlowStateMachineModule"
   ]
  },
  {
   "name": "ModularWeapon",
   "layer": "Features",
   "group": "ItemSystem",
   "path": "Content/Features/ItemSystem/ModularWeapon",
   "files": 11,
   "editorFiles": 0,
   "namespaces": [
    "ItemModule.ModularWeapon"
   ],
   "interfaces": [
    "IWeaponModuleDataService",
    "IWeaponModuleFactory"
   ],
   "installers": [
    "ModularWeaponInstaller"
   ],
   "configs": [
    "WeaponModuleConfiguration",
    "WeaponModuleConfigurations"
   ],
   "deps": [
    "AssetLoaderModule",
    "Core",
    "WeaponSystem"
   ],
   "desc": "Модулі зброї та їхні бонуси до характеристик.",
   "tasks": [
    "BUG-12",
    "AG-026",
    "AG-027",
    "AG-028"
   ],
   "usedBy": [
    "Core",
    "GameFlowStateMachineModule",
    "WeaponSystem"
   ]
  },
  {
   "name": "Spread",
   "layer": "Features",
   "group": "ItemSystem",
   "path": "Content/Features/ItemSystem/Spread",
   "files": 6,
   "editorFiles": 0,
   "namespaces": [
    "ItemModule.Spread"
   ],
   "interfaces": [
    "ISpread",
    "ISpreadCalculator"
   ],
   "installers": [
    "SpreadInstaller"
   ],
   "configs": [],
   "deps": [],
   "desc": "Розкид при стрільбі та його відновлення.",
   "tasks": [],
   "usedBy": [
    "Core",
    "GameFlowStateMachineModule",
    "WeaponSystem"
   ]
  },
  {
   "name": "Throwable",
   "layer": "Features",
   "group": "ItemSystem",
   "path": "Content/Features/ItemSystem/Throwable",
   "files": 22,
   "editorFiles": 0,
   "namespaces": [
    "ItemModule.Throwable",
    "ItemModule.Throwable.Aim",
    "ItemModule.Throwable.Combat"
   ],
   "interfaces": [
    "IThrowAim",
    "IThrowAimHandler",
    "IThrowableDataService",
    "IThrowableFactory",
    "IThrowableTrajectoryView"
   ],
   "installers": [
    "ThrowableInstaller"
   ],
   "configs": [
    "ThrowableConfiguration",
    "ThrowableConfigurations"
   ],
   "deps": [
    "AssetLoaderModule",
    "CameraModule",
    "Combat",
    "Core",
    "InputModule",
    "LoggerModule"
   ],
   "desc": "Метальні предмети: прицілювання, траєкторія, вибух.",
   "tasks": [
    "BUG-11"
   ],
   "usedBy": [
    "Core",
    "GameFlowStateMachineModule"
   ]
  },
  {
   "name": "WeaponSystem",
   "layer": "Features",
   "group": "ItemSystem",
   "path": "Content/Features/ItemSystem/WeaponSystem",
   "files": 33,
   "editorFiles": 0,
   "namespaces": [
    "ItemModule.Weapon",
    "ItemModule.Weapon.Aim",
    "ItemModule.Weapon.Combat"
   ],
   "interfaces": [
    "IAim",
    "IAimHandler",
    "IAmmo",
    "IDamageableHandler",
    "IReloadable",
    "IShotEffectsHandler",
    "IWeaponDataService",
    "IWeaponFactory",
    "IWeaponModifierService",
    "IWeaponStatModifier"
   ],
   "installers": [
    "WeaponInstaller"
   ],
   "configs": [
    "WeaponConfiguration",
    "WeaponConfigurations"
   ],
   "deps": [
    "AssetLoaderModule",
    "Combat",
    "Core",
    "EntityModule",
    "EvidenceModule",
    "InputModule",
    "LoggerModule",
    "ModularWeapon",
    "PoolModule",
    "Spread"
   ],
   "desc": "Вогнепальна зброя: стрільба, набої, перезарядка, приціл, модифікатори.",
   "tasks": [
    "BUG-09",
    "BUG-15",
    "BUG-16",
    "BUG-17",
    "AG-025",
    "AG-029"
   ],
   "usedBy": [
    "Core",
    "EntityModule",
    "GameFlowStateMachineModule",
    "Hand",
    "LootModule",
    "ModularWeapon",
    "StorageModule"
   ]
  },
  {
   "name": "LocationModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/LocationModule",
   "files": 7,
   "editorFiles": 0,
   "namespaces": [
    "LocationModule",
    "LocationModule.Configurations"
   ],
   "interfaces": [
    "ILocationRegistry",
    "ILocationService"
   ],
   "installers": [
    "LocationInstaller"
   ],
   "configs": [
    "LocationConfig"
   ],
   "deps": [
    "SceneLoaderServiceModule"
   ],
   "desc": "Локації, їх стан і реєстр, переходи між ними.",
   "tasks": [],
   "usedBy": [
    "GameFlowStateMachineModule"
   ]
  },
  {
   "name": "LootModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/LootModule",
   "files": 10,
   "editorFiles": 0,
   "namespaces": [
    "LootModule"
   ],
   "interfaces": [
    "ILootCollectorService",
    "ILootHandler",
    "ILootProgressService"
   ],
   "installers": [
    "LootInstaller"
   ],
   "configs": [],
   "deps": [
    "Core",
    "InteractableModule",
    "LoggerModule",
    "PrefabFactoryModule",
    "SaveModule",
    "StorageModule",
    "WeaponSystem"
   ],
   "desc": "Лут на рівнях, збір і збереження прогресу збору.",
   "tasks": [
    "BUG-10"
   ],
   "usedBy": [
    "EntityActionModule",
    "EvidenceModule",
    "GameFlowStateMachineModule",
    "InteractableModule"
   ]
  },
  {
   "name": "NoiseModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/NoiseModule",
   "files": 4,
   "editorFiles": 0,
   "namespaces": [
    "NoiseModule"
   ],
   "interfaces": [
    "INoiseListener"
   ],
   "installers": [],
   "configs": [],
   "deps": [],
   "desc": "Шум від дій гравця і реакція слухачів.",
   "tasks": [
    "BUG-14"
   ],
   "usedBy": [
    "EntityModule"
   ]
  },
  {
   "name": "Data",
   "layer": "Features",
   "group": "PlayerSystem",
   "path": "Content/Features/PlayerSystem/Data",
   "files": 3,
   "editorFiles": 0,
   "namespaces": [
    "PlayerModule.Data"
   ],
   "interfaces": [],
   "installers": [
    "PlayerDataInstaller"
   ],
   "configs": [],
   "deps": [],
   "desc": "Дані гравця: позиція та трансформ.",
   "tasks": [],
   "usedBy": [
    "CameraModule",
    "GameFlowStateMachineModule"
   ]
  },
  {
   "name": "Hand",
   "layer": "Features",
   "group": "PlayerSystem",
   "path": "Content/Features/PlayerSystem/Hand",
   "files": 14,
   "editorFiles": 0,
   "namespaces": [
    "PlayerModule.Hand"
   ],
   "interfaces": [
    "IPlayerHand",
    "IPlayerHandService",
    "IPlayerHandView",
    "IPlayerHandViewService"
   ],
   "installers": [
    "PlayerHandInstaller"
   ],
   "configs": [],
   "deps": [
    "Core",
    "HandModule",
    "InputModule",
    "LoggerModule",
    "PoolModule",
    "PrefabFactoryModule",
    "SlotModule",
    "WeaponSystem"
   ],
   "desc": "Руки гравця: екіпірування, ввід, дворучна зброя.",
   "tasks": [],
   "usedBy": [
    "Core",
    "GameFlowStateMachineModule",
    "ScreenModule",
    "Storage"
   ]
  },
  {
   "name": "Health",
   "layer": "Features",
   "group": "PlayerSystem",
   "path": "Content/Features/PlayerSystem/Health",
   "files": 6,
   "editorFiles": 0,
   "namespaces": [
    "PlayerModule.Health"
   ],
   "interfaces": [],
   "installers": [
    "PlayerHealthInstaller"
   ],
   "configs": [],
   "deps": [
    "StatsModule"
   ],
   "desc": "Здоров'я гравця та його відображення.",
   "tasks": [],
   "usedBy": [
    "GameFlowStateMachineModule",
    "Stats"
   ]
  },
  {
   "name": "Personality",
   "layer": "Features",
   "group": "PlayerSystem",
   "path": "Content/Features/PlayerSystem/Personality",
   "files": 5,
   "editorFiles": 0,
   "namespaces": [
    "PlayerModule.Personality"
   ],
   "interfaces": [
    "IPsychotypeService"
   ],
   "installers": [
    "PsychotypeInstaller"
   ],
   "configs": [
    "PsychotypeConfiguration",
    "PsychotypeSettings"
   ],
   "deps": [
    "DialogueModule"
   ],
   "desc": "Психотип гравця: очки, домінантний тип, налаштування.",
   "tasks": [
    "AG-012",
    "AG-013"
   ],
   "usedBy": [
    "DialogueModule",
    "EvidenceModule",
    "GameFlowStateMachineModule",
    "InvestigationTool",
    "ScreenModule"
   ]
  },
  {
   "name": "Stats",
   "layer": "Features",
   "group": "PlayerSystem",
   "path": "Content/Features/PlayerSystem/Stats",
   "files": 11,
   "editorFiles": 0,
   "namespaces": [
    "PlayerModule.Stats"
   ],
   "interfaces": [
    "IPlayerStatsModel",
    "IPlayerStatsService"
   ],
   "installers": [
    "PlayerStatsInstaller"
   ],
   "configs": [],
   "deps": [
    "EntityModule",
    "Health",
    "LoggerModule",
    "StatsModule"
   ],
   "desc": "Ресурси гравця: здоров'я, витривалість, стрес.",
   "tasks": [
    "AG-006",
    "AG-007",
    "AG-008"
   ],
   "usedBy": [
    "EntityModule",
    "EvidenceModule",
    "GameFlowStateMachineModule",
    "InvestigationTool",
    "ScreenModule"
   ]
  },
  {
   "name": "Storage",
   "layer": "Features",
   "group": "PlayerSystem",
   "path": "Content/Features/PlayerSystem/Storage",
   "files": 6,
   "editorFiles": 0,
   "namespaces": [
    "PlayerModule.Storage"
   ],
   "interfaces": [
    "IPlayerStorageView"
   ],
   "installers": [
    "PlayerStorageInstaller"
   ],
   "configs": [],
   "deps": [
    "AssetLoaderModule",
    "Core",
    "Hand",
    "HandModule",
    "PoolModule",
    "SaveModule",
    "SlotModule",
    "StorageModule"
   ],
   "desc": "Інвентар гравця і його збереження.",
   "tasks": [
    "BUG-08",
    "AG-032"
   ],
   "usedBy": [
    "EconomyModule",
    "GameFlowStateMachineModule",
    "ScreenModule"
   ]
  },
  {
   "name": "Wallet",
   "layer": "Features",
   "group": "PlayerSystem",
   "path": "Content/Features/PlayerSystem/Wallet",
   "files": 6,
   "editorFiles": 0,
   "namespaces": [
    "PlayerModule.Wallet",
    "ScreenModule"
   ],
   "interfaces": [
    "IWalletService"
   ],
   "installers": [
    "WalletInstaller"
   ],
   "configs": [
    "WalletSettings"
   ],
   "deps": [
    "LoggerModule",
    "SaveModule"
   ],
   "desc": "Гаманець (кредити) і його збереження.",
   "tasks": [
    "BUG-05",
    "BUG-19"
   ],
   "usedBy": [
    "EconomyModule",
    "GameFlowStateMachineModule"
   ]
  },
  {
   "name": "PrefabFactoryModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/PrefabFactoryModule",
   "files": 5,
   "editorFiles": 0,
   "namespaces": [
    "PrefabFactoryModule"
   ],
   "interfaces": [
    "IPrefabsFactory"
   ],
   "installers": [
    "PrefabSpawnerInstaller"
   ],
   "configs": [],
   "deps": [
    "AssetLoaderModule",
    "InitializationModule"
   ],
   "desc": "Фабрики створення префабів через DI.",
   "tasks": [],
   "usedBy": [
    "CameraModule",
    "Core",
    "EntityModule",
    "GameFlowStateMachineModule",
    "Hand",
    "LootModule"
   ]
  },
  {
   "name": "QuestModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/QuestModule",
   "files": 25,
   "editorFiles": 1,
   "namespaces": [
    "QuestModule",
    "QuestModule.Editor"
   ],
   "interfaces": [
    "IQuestService",
    "IQuestView"
   ],
   "installers": [
    "QuestInstaller"
   ],
   "configs": [
    "QuestDataConfiguration",
    "QuestsConfigurations"
   ],
   "deps": [
    "AssetLoaderModule",
    "EvidenceModule",
    "GameEventModule",
    "LoggerModule",
    "PoolModule"
   ],
   "desc": "Квести: кроки на подіях, зони-тригери, UI квестів, редактор.",
   "tasks": [
    "BUG-06",
    "BUG-20",
    "AG-040",
    "AG-041"
   ],
   "usedBy": [
    "EntityModule",
    "GameFlowStateMachineModule",
    "ScreenModule"
   ]
  },
  {
   "name": "ScreenModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/ScreenModule",
   "files": 21,
   "editorFiles": 0,
   "namespaces": [
    "ScreenModule",
    "SoulStone.ScreenService"
   ],
   "interfaces": [
    "IScreenService"
   ],
   "installers": [
    "PickupNotificationInstaller",
    "ScreenInstaller"
   ],
   "configs": [],
   "deps": [
    "AudioModule",
    "Core",
    "DialogueModule",
    "EvidenceModule",
    "Hand",
    "InitializationModule",
    "LoggerModule",
    "Personality",
    "PoolModule",
    "QuestModule",
    "SlotModule",
    "Stats",
    "Storage",
    "StorageModule"
   ],
   "desc": "Екрани UI: відкриття/закриття, кнопки, сповіщення, досьє.",
   "tasks": [
    "BUG-02",
    "AG-021"
   ],
   "usedBy": []
  },
  {
   "name": "StatsModule",
   "layer": "Features",
   "group": null,
   "path": "Content/Features/StatsModule",
   "files": 8,
   "editorFiles": 0,
   "namespaces": [
    "StatsModule",
    "StatsModule.Endurance",
    "StatsModule.Health",
    "StatsModule.Stress"
   ],
   "interfaces": [
    "IBoundedStat",
    "IEndurance",
    "IHealth",
    "IStress"
   ],
   "installers": [],
   "configs": [],
   "deps": [
    "EntityModule",
    "LoggerModule"
   ],
   "desc": "Обмежені ресурси (база MonoBoundedStat): здоров'я, витривалість, стрес.",
   "tasks": [
    "AG-006",
    "BUG-23"
   ],
   "usedBy": [
    "Combat",
    "EntityModule",
    "Health",
    "MedItem",
    "Stats"
   ]
  },
  {
   "name": "SlotModule",
   "layer": "Features",
   "group": "StorageSystem",
   "path": "Content/Features/StorageSystem/SlotModule",
   "files": 2,
   "editorFiles": 0,
   "namespaces": [
    "SlotModule"
   ],
   "interfaces": [
    "ISlotView"
   ],
   "installers": [],
   "configs": [],
   "deps": [
    "Core",
    "PoolModule",
    "StorageModule"
   ],
   "desc": "Слоти інвентарю: перетягування, відображення.",
   "tasks": [
    "BUG-18"
   ],
   "usedBy": [
    "Core",
    "Hand",
    "ScreenModule",
    "Storage"
   ]
  },
  {
   "name": "StorageModule",
   "layer": "Features",
   "group": "StorageSystem",
   "path": "Content/Features/StorageSystem/StorageModule",
   "files": 6,
   "editorFiles": 0,
   "namespaces": [
    "StorageModule"
   ],
   "interfaces": [
    "IEntityStorage",
    "IStorage",
    "IStorageFactory"
   ],
   "installers": [
    "StorageModuleInstaller"
   ],
   "configs": [],
   "deps": [
    "Core",
    "WeaponSystem"
   ],
   "desc": "Сховище предметів (стандартне), набої в резерві.",
   "tasks": [],
   "usedBy": [
    "Core",
    "EntityModule",
    "GameFlowStateMachineModule",
    "InvestigationTool",
    "LootModule",
    "MedItem",
    "ScreenModule",
    "SlotModule",
    "Storage"
   ]
  }
 ]
};
