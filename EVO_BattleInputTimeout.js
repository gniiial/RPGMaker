/*:
 * @plugindesc Minimal actor-command input timeout for RPG Maker MV.
 * @author Gniiial
 * --------------------------
 * @license GPL-3.0-or-later
 * --------------------------
 * This plugin is free software: you may use, modify, and redistribute it
 * under the terms of the GNU General Public License v3.0 or later.
 *
 * Modified versions distributed to others must remain under the same license
 * and include the corresponding source code.
 * -------------------------------------------------------------------------------
 * @param Time Limit
 * @type number
 * @min 1
 * @desc How many frames the player has for each actor input. 60 frames = about 1 second.
 * @default 300
 *
 * @param Timeout Skill ID
 * @type skill
 * @desc Skill used when the actor times out. Make this a Wait/Pass/Hesitate skill.
 * @default 1
 *
 * @param Enable Switch ID
 * @type switch
 * @desc If 0, the timeout is always active. If set, timeout only works while this switch is ON.
 * @default 0
 *
 * @param Timer Variable ID
 * @type variable
 * @desc Optional. Stores remaining frames for testing/debugging. Use 0 to disable.
 * @default 0
 *
 * @param Fight Timer
 * @type number
 * @min 0
 * @desc When in Fight/Escape selection. In frames. 0 disables party command timeout.
 * @default 600
 *
 * @param Show Counter
 * @type boolean
 * @on ON
 * @off OFF
 * @desc Show a centered countdown number during battle command timers.
 * @default true
 *
 * @param Count Down
 * @type number
 * @min 1
 * @desc Counter only appears when this many frames or less remain. 300 = last 5 seconds.
 * @default 300
 *
 * @param Counter Font Size
 * @type number
 * @min 1
 * @desc Font size for the centered countdown number.
 * @default 72
 *
 * @param Counter Font Color
 * @type string
 * @desc Font color for the centered countdown number.
 * @default #fd7e01
 *
 * @param Counter Outline Color
 * @type string
 * @desc Outline color for the centered countdown number.
 * @default #4766c9
 *
 * @help
 * Minimal battle input timeout.
 *
 * Setup:
 * 1. Create a Wait/Pass skill in the database.
 * 2. Set "Timeout Skill ID" to that skill.
 * 3. Set "Time Limit Frames".
 *    60 = about 1 second.
 *    300 = about 5 seconds.
 *    600 = about 10 seconds.
 *
 * If Enable Switch ID is 0, the system is always active in battle.
 * If Enable Switch ID is set, turn that switch ON before battles where you want the timeout.
 */

(function() {
    'use strict';

    var pluginName = 'EVO_BattleInputTimeout';
    var params = PluginManager.parameters(pluginName);

    var TIME_LIMIT = Number(params['Time Limit'] || 300);
    var TIMEOUT_SKILL_ID = Number(params['Timeout Skill ID'] || 1);
    var ENABLE_SWITCH_ID = Number(params['Enable Switch ID'] || 0);
    var TIMER_VARIABLE_ID = Number(params['Timer Variable ID'] || 0);
	var PARTY_FIGHT_FRAMES = Number(params['Fight Timer'] || 600);
	var SHOW_COUNTER = String(params['Show Counter'] || 'true') === 'true';
	var COUNTDOWN_FRAMES = Number(params['Count Down'] || 300);
	var COUNTER_FONT_SIZE = Number(params['Counter Font Size'] || 72);
	var COUNTER_FONT_COLOR = String(params['Counter Font Color'] || '#fd7e01');
	var COUNTER_OUTLINE_COLOR = String(params['Counter Outline Color'] || '#4766c9');

    function timeoutEnabled() {
        if (!$gameParty.inBattle()) return false;
        if (ENABLE_SWITCH_ID <= 0) return true;
        return $gameSwitches.value(ENABLE_SWITCH_ID);
    }

    function commandInputWindowActive(scene) {
        return (
            scene._actorCommandWindow && scene._actorCommandWindow.active ||
            scene._skillWindow && scene._skillWindow.active ||
            scene._itemWindow && scene._itemWindow.active ||
            scene._actorWindow && scene._actorWindow.active ||
            scene._enemyWindow && scene._enemyWindow.active
        );
    }

    function closeInputSubWindows(scene) {
        if (scene._skillWindow) {
            scene._skillWindow.hide();
            scene._skillWindow.deactivate();
        }
        if (scene._itemWindow) {
            scene._itemWindow.hide();
            scene._itemWindow.deactivate();
        }
        if (scene._actorWindow) {
            scene._actorWindow.hide();
            scene._actorWindow.deactivate();
        }
        if (scene._enemyWindow) {
            scene._enemyWindow.hide();
            scene._enemyWindow.deactivate();
        }
    }
	
	Scene_Battle.prototype.createEvoTimeoutCounter = function() {
		if (!SHOW_COUNTER) {
			return;
		}

		this._evoTimeoutCounterSprite = new Sprite();
		this._evoTimeoutCounterSprite.bitmap = new Bitmap(240, 120);
		this._evoTimeoutCounterSprite.anchor.x = 0.5;
		this._evoTimeoutCounterSprite.anchor.y = 0.5;
		this._evoTimeoutCounterSprite.x = Graphics.boxWidth / 2;
		this._evoTimeoutCounterSprite.y = Graphics.boxHeight / 2;
		this._evoTimeoutCounterSprite.visible = false;

		this.addChild(this._evoTimeoutCounterSprite);
	};

	Scene_Battle.prototype.updateEvoTimeoutCounter = function(frames) {
		if (!SHOW_COUNTER || !this._evoTimeoutCounterSprite) {
			return;
		}
		
		if (frames <= 0 || frames > COUNTDOWN_FRAMES) {
			this.hideEvoTimeoutCounter();
			return;
		}

		var number = Math.ceil(frames / 60);

		if (this._evoCounterNumber === number && this._evoTimeoutCounterSprite.visible) {
			return;
		}

		this._evoCounterNumber = number;

		var bitmap = this._evoTimeoutCounterSprite.bitmap;
		bitmap.clear();
		bitmap.fontSize = COUNTER_FONT_SIZE;
		bitmap.textColor = COUNTER_FONT_COLOR;
		bitmap.outlineColor = COUNTER_OUTLINE_COLOR;
		bitmap.outlineWidth = 6;
		bitmap.drawText(String(number), 0, 0, 240, 120, 'center');

		this._evoTimeoutCounterSprite.visible = true;
	};

	Scene_Battle.prototype.hideEvoTimeoutCounter = function() {
		if (!SHOW_COUNTER || !this._evoTimeoutCounterSprite) {
			return;
		}

		this._evoCounterNumber = null;
		this._evoTimeoutCounterSprite.visible = false;
	};

    var _Scene_Battle_create = Scene_Battle.prototype.create;
    Scene_Battle.prototype.create = function() {
        _Scene_Battle_create.call(this);
        this._evoInputTimeoutActor = null;
        this._evoInputTimeoutFrames = TIME_LIMIT;
		this._evoPartyFightFrames = PARTY_FIGHT_FRAMES;
		this._evoCounterNumber = null;
		this.createEvoTimeoutCounter();
    };

    var _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function() {
        _Scene_Battle_update.call(this);
        this.updateEvoInputTimeout();
    };

    Scene_Battle.prototype.updateEvoInputTimeout = function() {
		if (!timeoutEnabled()) {
			this.resetEvoInputTimeout();
			this.resetEvoPartyCommandTimeout();
			this.hideEvoTimeoutCounter();
			return;
		}

		if (!BattleManager.isInputting()) {
			this.resetEvoInputTimeout();
			this.resetEvoPartyCommandTimeout();
			this.hideEvoTimeoutCounter();
			return;
		}

		if (this.updateEvoPartyCommandTimeout()) {
			return;
		}

		var actor = BattleManager.actor();

		if (!actor) {
			this.resetEvoInputTimeout();
			return;
		}

        if (!commandInputWindowActive(this)) {
            return;
        }

		if (this._evoInputTimeoutActor !== actor) {
			this._evoInputTimeoutActor = actor;
			this._evoInputTimeoutFrames = TIME_LIMIT;
		}

        this._evoInputTimeoutFrames--;
		this.updateEvoTimeoutCounter(this._evoInputTimeoutFrames);

        if (TIMER_VARIABLE_ID > 0) {
            $gameVariables.setValue(TIMER_VARIABLE_ID, Math.max(this._evoInputTimeoutFrames, 0));
        }

        if (this._evoInputTimeoutFrames <= 0) {
            this.applyEvoInputTimeout(actor);
        }
    };

	Scene_Battle.prototype.updateEvoPartyCommandTimeout = function() {
		if (PARTY_FIGHT_FRAMES <= 0) {
			return false;
		}

		if (!this._partyCommandWindow || !this._partyCommandWindow.active) {
			this.resetEvoPartyCommandTimeout();
			return false;
		}

		this._evoPartyFightFrames--;
		this.updateEvoTimeoutCounter(this._evoPartyFightFrames);

		if (this._evoPartyFightFrames <= 0) {
			this.applyEvoPartyFightFrames();
			return true;
		}

		return true;
	};

	Scene_Battle.prototype.resetEvoPartyCommandTimeout = function() {
		this._evoPartyFightFrames = PARTY_FIGHT_FRAMES;
	};

	Scene_Battle.prototype.applyEvoPartyFightFrames = function() {
		SoundManager.playOk();

		if (this._partyCommandWindow) {
			this._partyCommandWindow.deactivate();
			this._partyCommandWindow.close();
		}

		this._evoPartyFightFrames = PARTY_FIGHT_FRAMES;
		this.hideEvoTimeoutCounter();

		this.commandFight();
	};

	Scene_Battle.prototype.resetEvoInputTimeout = function() {
		this._evoInputTimeoutActor = null;
		this._evoInputTimeoutFrames = TIME_LIMIT;
		this.hideEvoTimeoutCounter();

		if (TIMER_VARIABLE_ID > 0) {
			$gameVariables.setValue(TIMER_VARIABLE_ID, TIME_LIMIT);
		}
	};

	Scene_Battle.prototype.applyEvoInputTimeout = function(actor) {
		SoundManager.playCancel();
		closeInputSubWindows(this);

		if (this._actorCommandWindow) {
			this._actorCommandWindow.deactivate();
		}

		actor.clearActions();

		this._evoInputTimeoutActor = null;
		this._evoInputTimeoutFrames = TIME_LIMIT;
		this.hideEvoTimeoutCounter();

		this.selectNextCommand();
	};

})();