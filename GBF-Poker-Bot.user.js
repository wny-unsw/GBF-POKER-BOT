// ==UserScript==
// @name         GBF Poker Bot
// @namespace    http://tampermonkey.net/
// @version      2025-05-07
// @description  Automating GBF Poker Game
// @author       A Newbie Skyfarer
// @match        https://game.granbluefantasy.jp/*
// @match        https://gbf.game.mbga.jp/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// ==/UserScript==

/*
FSM for GBF Poker Game
States:
    - s1: Initial(DEAL)
    - s2: KEEP
    - s3: START/CONTINUE HOL
    - s4: HOL
    - s0: System Crash/Exception
Transitions:
    - s1 -> s2: Tap DEAL button
    - s2 -> s1: Tap OK button and get loosing hand
    - s2 -> s3: Tap OK button and get winning hand
    - s3 -> s1: Tap NO button
    - s3 -> s4: Tap YES button
    - s4 -> s1: Tap LOW or HIGH button and loose || finish game
    - s4 -> s3: Tap LOW or HIGH button and win
*/
/*
    Keep Logic in partial order of priority:
    // Winning hands (immediate keep)
    (#suit = 5)           > (2 pairs)
    (#rank >= 3)          > (2 pairs)
    (#seq = 5)            > (2 pairs)
    // One card away from winning
    (2 pairs)             > (#suit = 4)
    (2 pairs)             > (#seq = 4)
    // Two cards away from winning
    (#suit = 4)           > (1 pair)    // flush draw > single pair
    (#seq = 4)            > (1 pair)    // straight draw > single pair
    // Otherwise Discard all
*/
'use strict';
const regx = /poker/;
if(regx.test(location.hash)){
    (()=>{
        console.info("GBF Poker Bot Script Loaded, launching in 5 seconds...");
        setTimeout(()=>{
            let isRunning = false
            ,loopTimer = null
            ,rebootTimer = null
            ,timeout = 0
            ,stats = {
                START_TIME:new Date().toLocaleString(),
                INIT_CHIP:0,
                CNT_DRAW:0,
                CNT_DOUBLE_UP:0,
                CNT_DOUBLE_UP_WIN:0,
            }
            const userConfig = {
                verbose: false, // Set to true for debugging
                ttl: 45, // in minutes
                autoReboot: true, // Set to true will run bot automatically after page reload
                rebootInterval: 2, // in minutes, working only if autoReboot is true
                AdditionalWaitTime: 2, // in minutes, additional wait time before reboot
                saveLog: true,
                displayPerXRounds: 10, // Number of rounds to display in console
            }
            ,displayStats = () => {
                console.info('===========================');
                let delta = readMedal()-stats.INIT_CHIP;
                console.info('Duration in minutes: '+~~((new Date()-new Date(stats.START_TIME))/1000/60));
                console.info('# of Draw: '+stats.CNT_DRAW);
                console.info('Initial Chips: '+stats.INIT_CHIP);
                console.info('%cChips Earned: '+delta, (delta>0) ? 'color: green' : 'color: red');
                console.info('===========================');
            },saveSessionLog = (info) => {
                if(!userConfig.saveLog){return}
                const session = {
                    time: new Date().toLocaleString(),
                    duration: ~~((new Date()-new Date(stats.START_TIME))/1000/60),
                    draws: stats.CNT_DRAW,
                    initialChips: stats.INIT_CHIP,
                    chipsEarned: readMedal()-stats.INIT_CHIP,
                    info: info,
                }
                let log = GM_getValue("POKER_BOT_SESSION_LOG", []);
                log.push(session);
                GM_setValue("POKER_BOT_SESSION_LOG", log);
                console.info('%cSession log saved:', 'color: green');
            }
            const STATE_UNDEF = 0
            ,STATE_DEAL = 1
            ,STATE_KEEP = 2
            ,STATE_HOL_CONTINUE = 3
            ,STATE_HOL = 4
            let PREV_STATE = STATE_UNDEF;
            const et = 'ontouchstart' in window ? 'touchstart' : 'mousedown'
            ,styleArr=['color:#000000','color:#307730','color:#AAAAAA','color:white; background-color:#77A8F3','color:white; background-color:#0055CC','color:white; background-color:#B03939']
            ,sout = (inf,sty=0) => {if(!userConfig.verbose){return;}console.info('%c'+inf,styleArr[~~sty])}
            ,iv = (sel)=>{return $(sel).is(':visible')}
            ,tp = (sel)=>{$(sel).trigger('tap')}
            ,readNumber = (sel)=>{let _=$('div',sel),__=_.size()-1,___=0;_.each(function(i,____){___+=~~____.className.split('_')[1]*Math.pow(10,__-i)});return ___}
            ,ce = (en)=>{$('#canv').trigger(en)}
            ,ce2 = (i)=>{exportRoot["card_" + i + "_select"]=1}
            ,getState=()=>{
                if(iv('.prt-start')) return STATE_DEAL; // DEAL
                if(iv('.prt-ok')) return STATE_KEEP; // KEEP
                if(iv('.prt-yes')) return STATE_HOL_CONTINUE; // START/CONTINUE HOL
                if(iv('.prt-double-select')) return STATE_HOL; // HOL
                return STATE_UNDEF; // Undefined state
            }
            ,act = {
                tapstart:()=>{sout('TAP DEAL');tp('.prt-start')},
                tapok:()=>{sout('TAP OK');tp('.prt-ok')},
                tapyes:()=>{sout('TAP YES');tp('.prt-yes')},
                tapno:()=>{sout('TAP NO');tp('.prt-no')},
                taphigh:()=>{sout('TAP HIGH');tp('.prt-double-select[select=high]')},
                taplow:()=>{sout('TAP LOW');tp('.prt-double-select[select=low]')},
                keepCard:(i)=>{sout('KEEP card'+i);ce('set'+i);ce2(i)},
            }
            function card(raw,ind){
                // sout(raw);
                const _ = raw.split('_');
                this.suit = ~~_[0]; // ♠:1 ♥:2 ♦:3 ♣:4 Joker: 99_99
                this.rank = ~~_[1];
                this.ind = ind+1; // 1-5
            }
            const readHand=()=>{return cards_1_Array.map((v,i)=>{return new card(v,i)});} // Used in KEEP state
            ,readDoubleUp=(i)=>{return new card(unsafeWindow['doubleUp_card_'+i],0)}// Used in HOL state
            ,readMedal=()=>{return readNumber('.prt-medal')}
            ,readBet=()=>{return readNumber('.prt-bet')}
            ,keepLogic=(hand)=>{
                const sorted = [...hand].sort((a, b) => a.rank - b.rank);
                const existJoker = sorted[4].rank==99 ? true : false; // Joker is always the last card
                /**
                 * Suit Based Logic:
                 * suitDict
                 * 1:[2,3],2:[1],3:[5],4:[4],99:[]
                 * then push joker's ind if existJoker, suppose joker ind is 2
                 * 1:[3,2],2:[1,2],3:[5,2],4:[4,2],99:[2]
                 */
                let suitDict = {1:[],2:[],3:[],4:[],99:[]};
                for(let c of sorted){suitDict[c.suit].push(c.ind);}
                // if existJoker, add joker ind to all suits
                if(existJoker){
                    for(let k in suitDict){
                        suitDict[k].push(sorted[4].ind); // Joker is always the 4th card in the sorted array
                    }
                }
                let largestSuit = []; // arr of card ind (1-5) of the largest suit
                for(let k in suitDict){
                    if(suitDict[k].length>largestSuit.length) largestSuit = suitDict[k];
                }
                // return flush
                if(largestSuit.length>=5){
                    sout('Largest Suit: '+largestSuit);
                    return largestSuit;
                }
                /**
                 * Same Rank Based Logic:
                 * Same Rank Group = [[ind,ind,ind][ind,ind]] 
                 */
                let sameRankGroup = [];
                let sameRank = [sorted[0].ind];
                for(let i=1;i<sorted.length;i++){
                    if(sorted[i].rank==sorted[i-1].rank){
                        sameRank.push(sorted[i].ind);
                    }else{
                        if (sameRank.length>1){
                            sameRankGroup.push(sameRank);
                        }
                        sameRank = [sorted[i].ind];
                    }
                }
                if (sameRank.length > 1) sameRankGroup.push(sameRank);
                let sameRankToKeep = sameRankGroup.flat();
                if((existJoker)&&sameRankToKeep.length>0){sameRankToKeep.push(sorted[4].ind);} // Joker is always the last card in the sorted array
                /**
                 * Sequential Based Logic:
                 * consec = [ind,ind,ind,ind,ind]
                 */
                const sorted1 = (sorted[0].rank==1) ?
                    [...hand, new card(sorted[0].suit.toString()+'_14', sorted[0].ind-1)].sort((a, b) => a.rank - b.rank) : // add Ace as 14, pls refer to card constructor
                    [...hand].sort((a, b) => a.rank - b.rank);
                sout('sorted1: '+sorted1.map(v=>v.rank));
                let lastNum = sorted[0].rank;
                let consec = [sorted[0].ind];
                let cntJoker = (existJoker) ? 1 : 0;
                for(let i=1;i<sorted1.length;i++){
                    if(sorted1[i].rank==lastNum+1){
                        lastNum = sorted1[i].rank;
                        consec.push(sorted1[i].ind);
                    }else if(sorted1[i].rank==lastNum+2 && cntJoker>0){ // gap of 1
                        consec.push(sorted1[sorted1.length-1].ind); // joker
                        consec.push(sorted1[i].ind);
                        lastNum = sorted1[i].rank;
                        cntJoker--;
                    }else{
                        if(sorted1[i].rank==99&&cntJoker>0&&consec.length>=2){
                            consec.push(sorted1[i].ind); // joker
                            break;
                        }else if(consec.length>=3){
                            break;
                        }else{
                            consec = [sorted1[i].ind];
                            lastNum = sorted1[i].rank;
                            cntJoker = (existJoker) ? 1 : 0;
                        }
                    }
                }
                // return if 4+ consec;
                if(consec.length>=4){
                    sout('consec4+: '+consec);
                    return consec;
                }
                // return if 3+ of a kind OR two pairs
                if(sameRankToKeep.length>=3){
                    sout('Rank3+: '+sameRankToKeep);
                    return sameRankToKeep;
                }
                // return 4 flush draw
                if(largestSuit.length>=4){
                    sout('Largest Suit: '+largestSuit);
                    return largestSuit;
                }
                // return if exist pair
                if(sameRankToKeep.length>1){
                    sout('PAIR: '+sameRankToKeep);
                    return sameRankToKeep;
                }
                // return if 3 consec:
                if(consec.length>=3){
                    sout('Consec3: '+consec);
                    return consec;
                }
                if (existJoker) return [sorted[4].ind]; // Joker is always the last card in the sorted array
                return []; // discard all
            }
            ,botLoop={
                // Read State, Match Logic, Apply Action, Schedule Next Loop
                sleep:(caf)=>{
                    if(timeout++>10){
                        console.error('%c[FATAL] EXCEPTION. ABORT.', 'color: red');
                        clearTimeout(loopTimer);
                        saveSessionLog("FATAL ERROR, ABORT.");
                        window.location.reload();
                        return;
                    }
                    let slt= 1800+Math.random()*1200;
                    loopTimer=setTimeout(caf,slt)
                },
                run:()=>{
                    if(!isRunning){return;}
                    let state = getState();
                    switch(state){
                        case STATE_UNDEF:{
                            timeout++;
                            sout('timeout:'+timeout);
                            break;
                        }
                        case STATE_DEAL:{
                            timeout = 0;
                            sout('State: DEAL');
                            stats.DELTA_CHIP = readMedal()-stats.INIT_CHIP;
                            if (PREV_STATE!=STATE_UNDEF&&PREV_STATE!=STATE_DEAL){
                                stats.CNT_DRAW++;
                            }
                            if (stats.CNT_DRAW % userConfig.displayPerXRounds == 0) {
                                if(~~((new Date()-new Date(stats.START_TIME))/1000/60) >= userConfig.ttl){
                                    console.info('%c[INFO] Time Limit Reached.', 'color: orange');
                                    stop();
                                    return;
                                }
                                displayStats();
                            }
                            act.tapstart();
                            break;
                        }
                        case STATE_KEEP:{
                            timeout = 0;
                            sout('State: KEEP');
                            let hand = readHand();
                            for(let k of keepLogic(hand)){
                                act.keepCard(k);
                            }
                            act.tapok();
                            break;
                        }
                        case STATE_HOL_CONTINUE:{
                            timeout = 0;
                            sout('State: START/CONTINUE HOL');
                            act.tapyes();
                            break;
                        }
                        case STATE_HOL:{
                            timeout = 0;
                            sout('State: HOL');
                            let ca = readDoubleUp(1);
                            (ca.rank>=2 && ca.rank<=8) ? act.taphigh() : act.taplow(); // 2-8: HIGH, 9-A: LOW
                            break;
                        }
                    }
                    PREV_STATE = state;
                    botLoop.sleep(botLoop.run);
                }
            }
            ,boot=()=>{
                if(isRunning){
                    sout('[ABORT] GBF Poker Bot is already running...');
                    return false;
                }
                console.info('%c[BOT STARTED]', 'color: blue');
                stats.INIT_CHIP = readMedal();
                console.info('Initial Chips: '+stats.INIT_CHIP);
                isRunning = true;
                updataUIBotton();
                clearInterval(rebootTimer);
                botLoop.sleep(botLoop.run);
                return true;
            }
            ,stop=()=>{
                if(!isRunning){
                    sout('[ABORT] GBF Poker Bot is not running...');
                    return false;
                }
                clearTimeout(loopTimer);
                console.info('%c[BOT STOPPED]', 'color: red');
                displayStats();
                isRunning = false;
                updataUIBotton();
                saveSessionLog("Stop Gracefully.");
                if(userConfig.autoReboot){
                    let t = userConfig.rebootInterval + Math.random()*userConfig.AdditionalWaitTime;
                    console.info('%c[INFO] Reboot in '+ t +' minutes...', 'color: orange');
                    rebootTimer = setTimeout(()=>{
                        console.info('%c[INFO] Page will reload...', 'color: orange');
                        window.location.reload();
                    },userConfig.t*60*1000);
                }
                return true;
            };
            // UI
            const ctrlBox = document.createElement('div');
            ctrlBox.style.position = 'fixed';
            ctrlBox.style.top = '10px';
            ctrlBox.style.right = '10px';
            ctrlBox.style.zIndex = 9999;
            ctrlBox.style.background = '#fff';
            ctrlBox.style.padding = '10px';
            ctrlBox.style.border = '1px solid #ccc';
            ctrlBox.style.fontSize = '14px';
            ctrlBox.innerHTML = `
                <button id="BotSwitch">Start</button>
            `;
            document.body.appendChild(ctrlBox);
            const updataUIBotton = () => {
                document.getElementById('BotSwitch').innerText = isRunning ? 'Stop' : 'Start';
            };
            document.getElementById('BotSwitch').addEventListener('click', ()=>{
                userConfig.autoReboot = false; // Disable autoReboot when user click the button
                (isRunning) ? stop() : boot();

            });
            // Auto Reboot
            if(userConfig.autoReboot){
                console.info('%c[INFO] Auto Reboot is enabled. Run bot on page reload.', 'color: orange');
                boot();
            }
        }, 5000);
    })();
}
