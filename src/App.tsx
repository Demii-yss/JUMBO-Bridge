import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  GameState, GamePhase, PlayerPosition, Bid, PlayerProfile, NetworkMessage, TrickCard, Suit, Card, PlayLog, InteractionType
} from './types';
import { 
  generateDeck, shuffleDeck, dealCards, 
  isAuctionFinished, getTrickWinner, calculateHCP
} from './services/bridgeLogic';
import PlayerHand from './components/PlayerHand';
import BiddingBox from './components/BiddingBox';
import AuctionBoard from './components/AuctionBoard';
import { NEXT_TURN, PARTNER, TEXT, SUIT_SYMBOLS, SUIT_COLORS, ASSETS } from './constants';
import CardComponent from './components/Card';

// Declare PeerJS globally
declare const Peer: any;

const INITIAL_STATE: GameState = {
  phase: GamePhase.Lobby,
  hands: {
    [PlayerPosition.North]: [],
    [PlayerPosition.East]: [],
    [PlayerPosition.South]: [],
    [PlayerPosition.West]: [],
  },
  dealer: PlayerPosition.North,
  turn: PlayerPosition.North,
  vulnerability: { ns: false, ew: false },
  bidHistory: [],
  lastBid: null,
  contract: null,
  declarer: null,
  players: [],
  readyPlayers: [],
  currentTrick: [],
  tricksWon: {
      [PlayerPosition.North]: 0,
      [PlayerPosition.East]: 0,
      [PlayerPosition.South]: 0,
      [PlayerPosition.West]: 0,
  },
  playHistory: [],
  winningTeam: undefined,
  surrendered: false
};

const EMOTES = ['😀', '😂', '😎', '😭', '😡', '🤔'];

interface FlyingItem {
    id: number;
    type: InteractionType;
    fromSlot: string;
    toSlot: string;
}

const FlyingItemRenderer: React.FC<{ item: FlyingItem; onComplete: () => void }> = ({ item, onComplete }) => {
    const [style, setStyle] = useState<React.CSSProperties>({ 
        position: 'absolute', 
        opacity: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        transition: 'none'
    });

    const getCoords = (slot: string) => {
         if (slot === 'bottom') return { top: '85%', left: '50%' };
         if (slot === 'top') return { top: '15%', left: '50%' };
         if (slot === 'left') return { top: '50%', left: '15%' };
         if (slot === 'right') return { top: '50%', left: '85%' };
         return { top: '50%', left: '50%' };
    };

    useEffect(() => {
        const start = getCoords(item.fromSlot);
        const end = getCoords(item.toSlot);
        
        setStyle({
            position: 'absolute',
            left: start.left,
            top: start.top,
            transform: 'translate(-50%, -50%) scale(0.5) rotate(0deg)',
            opacity: 0,
            zIndex: 9999,
            pointerEvents: 'none',
            transition: 'none'
        });

        const timer1 = setTimeout(() => {
            setStyle(prev => ({
                ...prev,
                opacity: 1,
                transform: 'translate(-50%, -50%) scale(1) rotate(0deg)',
                transition: 'opacity 0.1s ease-out, transform 0.2s ease-out'
            }));
        }, 50);

        const timer2 = setTimeout(() => {
             setStyle({
                position: 'absolute',
                left: end.left,
                top: end.top,
                transform: 'translate(-50%, -50%) scale(1.5) rotate(720deg)',
                opacity: 1,
                zIndex: 9999,
                pointerEvents: 'none',
                transition: 'left 1s ease-in-out, top 1s ease-in-out, transform 1s ease-in-out' 
             });
        }, 300);

        const timer3 = setTimeout(() => {
             setStyle(prev => ({ ...prev, opacity: 0, transition: 'opacity 0.2s ease' }));
        }, 1300);

        const timer4 = setTimeout(onComplete, 1500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
        };
    }, [item]);

    const imgSrc = ASSETS.INTERACTIONS[item.type];

    return (
        <div style={style}>
             {imgSrc ? <img src={imgSrc} alt={item.type} className="w-16 h-16 object-contain drop-shadow-lg" /> : '🎁'}
        </div>
    );
};

function App() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const gameStateRef = useRef<GameState>(INITIAL_STATE);

  const [myPeerId, setMyPeerId] = useState<string>('');
  const [hostPeerId, setHostPeerId] = useState<string>('');
  const [myPosition, setMyPosition] = useState<PlayerPosition | null>(null);
  const myPositionRef = useRef<PlayerPosition | null>(null);

  const [playerName, setPlayerName] = useState<string>('Player');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState<string>('');
  const [systemMessage, setSystemMessage] = useState<string>('');
  
  const [activeEmotes, setActiveEmotes] = useState<Record<string, string>>({});
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<InteractionType | null>(null);
  
  const [hasRequestedRedeal, setHasRequestedRedeal] = useState(false);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  const peerRef = useRef<any>(null);
  const connRef = useRef<any>(null); 
  const clientsRef = useRef<any[]>([]);
  const isRedealingRef = useRef<boolean>(false);

  const isHost = myPosition === PlayerPosition.North; 

  useEffect(() => {
      gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
      myPositionRef.current = myPosition;
  }, [myPosition]);

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 100));
    return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
    }
  }, []);

  // --- Networking Setup ---

  const initPeer = () => {
    if (peerRef.current) return;
    const peer = new Peer(undefined, { 
        debug: 1,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    });

    peer.on('open', (id: string) => {
      setMyPeerId(id);
    });

    peer.on('connection', (conn: any) => {
      conn.on('data', (data: NetworkMessage) => {
        handleHostReceivedData(data, conn);
      });
      conn.on('open', () => {
         clientsRef.current.push(conn);
      });
      conn.on('close', () => {
         clientsRef.current = clientsRef.current.filter(c => c !== conn);
      });
    });

    peerRef.current = peer;
  };

  useEffect(() => {
    initPeer();
    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  // --- Helpers ---
  const copyRoomId = async (id: string) => {
      if (!id) return;
      try {
          await navigator.clipboard.writeText(id);
          setCopyFeedback(TEXT.COPIED);
          setTimeout(() => setCopyFeedback(''), 2000);
      } catch (err) {
          console.error("Failed to copy", err);
      }
  };

  const getRelativeSlot = (targetPos: PlayerPosition, myPos: PlayerPosition | null): 'bottom' | 'left' | 'top' | 'right' => {
      if (!myPos) return 'bottom';
      if (targetPos === myPos) return 'bottom';
      if (NEXT_TURN[myPos] === targetPos) return 'left';
      if (PARTNER[myPos] === targetPos) return 'top';
      return 'right';
  };

  // --- Interaction Handlers ---
  const handleEmote = (emoji: string) => {
      if (!myPosition) return;
      const msg: NetworkMessage = { type: 'ACTION_EMOTE', emoji, position: myPosition };
      sendAction(msg);
      setShowEmotePicker(false);
  };

  const handleInteraction = (targetPos: PlayerPosition) => {
      if (!myPosition || !selectedItemType) return;
      const msg: NetworkMessage = { type: 'ACTION_INTERACTION', interactionType: selectedItemType, from: myPosition, to: targetPos };
      sendAction(msg);
      setSelectedItemType(null); 
      setShowItemPicker(false);
  };

  const handleRequestRedeal = () => {
      if (!myPosition) return;
      setHasRequestedRedeal(true); 
      const points = calculateHCP(gameState.hands[myPosition]);
      sendAction({ type: 'ACTION_REQUEST_REDEAL', position: myPosition, points });
  };

  const triggerEmote = (pos: PlayerPosition, emoji: string) => {
      setActiveEmotes(prev => ({ ...prev, [pos]: emoji }));
      setTimeout(() => {
          setActiveEmotes(prev => {
              const next = { ...prev };
              if (next[pos] === emoji) delete next[pos];
              return next;
          });
      }, 3000);
  };

  const triggerInteraction = (type: InteractionType, from: PlayerPosition, to: PlayerPosition) => {
      const myPos = myPositionRef.current;
      const fromSlot = getRelativeSlot(from, myPos);
      const toSlot = getRelativeSlot(to, myPos);
      
      const newItem: FlyingItem = {
          id: Date.now() + Math.random(),
          type,
          fromSlot,
          toSlot
      };
      
      setFlyingItems(prev => [...prev, newItem]);
  };

  // --- Host Logic ---

  const handleHostReceivedData = (data: NetworkMessage, conn: any) => {
    const currentState = gameStateRef.current;

    if (data.type === 'ACTION_EMOTE') {
        broadcastMessage(data); 
        triggerEmote(data.position, data.emoji);
        return;
    }
    if (data.type === 'ACTION_INTERACTION') {
        broadcastMessage(data);
        triggerInteraction(data.interactionType, data.from, data.to);
        return;
    }
    if (data.type === 'ACTION_MESSAGE') {
        broadcastMessage(data);
        setSystemMessage(data.message);
        return;
    }
    if (data.type === 'ACTION_REQUEST_REDEAL') {
        if (currentState.phase !== GamePhase.Reviewing) return;
        if (isRedealingRef.current) return; 
        
        isRedealingRef.current = true;
        const player = currentState.players.find(p => p.position === data.position);
        const name = player ? player.name : TEXT[data.position];
        
        let countdown = 5;
        const tick = () => {
            if (countdown > 0) {
                const msg = `${TEXT.REDEAL_REQUESTED}: ${name} (${data.points} ${TEXT.POINTS}). ${countdown} ${TEXT.REDEALING_IN}`;
                setSystemMessage(msg);
                broadcastMessage({ type: 'ACTION_MESSAGE', message: msg });
                countdown--;
                setTimeout(tick, 1000);
            } else {
                 startNewDeal(false);
                 setSystemMessage('');
                 broadcastMessage({ type: 'ACTION_MESSAGE', message: '' });
                 isRedealingRef.current = false;
            }
        };
        tick();
        return;
    }
    
    setGameState(prev => {
      if (data.type === 'JOIN_REQUEST') {
        if (prev.players.length >= 4) return prev;
        const occupiedPositions = prev.players.map(p => p.position);
        
        const reserved = (prev.phase === GamePhase.Lobby && !occupiedPositions.includes(PlayerPosition.North)) 
            ? [PlayerPosition.North] 
            : [];
            
        const allPositions = [PlayerPosition.North, PlayerPosition.East, PlayerPosition.South, PlayerPosition.West];
        const available = allPositions.filter(p => !occupiedPositions.includes(p) && !reserved.includes(p));
        const nextPosition = available[0];

        if (!nextPosition) return prev;

        const newPlayer: PlayerProfile = {
          id: conn.peer,
          name: data.name,
          position: nextPosition,
          isHost: false
        };

        const newPlayers = [...prev.players, newPlayer];
        const newState = { ...prev, players: newPlayers };
        conn.send({ type: 'JOIN_ACCEPT', state: newState, yourPosition: nextPosition });
        broadcastState(newState, conn.peer);
        return newState;
      }

      if (data.type === 'ACTION_BID') return processBidLogic(prev, data.bid);
      if (data.type === 'ACTION_READY') return processReadyLogic(prev, data.position);
      if (data.type === 'ACTION_PLAY') return processPlayLogic(prev, data.card, data.position);
      if (data.type === 'ACTION_SURRENDER') return processSurrender(prev, data.position);
      if (data.type === 'ACTION_RESTART') { return prev; } 

      return prev;
    });
  };

  const broadcastState = (state: GameState, excludeId?: string) => {
    clientsRef.current.forEach(conn => {
      if (conn.open && conn.peer !== excludeId) {
        conn.send({ type: 'STATE_UPDATE', state });
      }
    });
  };

  const broadcastMessage = (msg: NetworkMessage, excludeId?: string) => {
      clientsRef.current.forEach(conn => {
        if (conn.open && conn.peer !== excludeId) {
            conn.send(msg);
        }
      });
  };

  useEffect(() => {
    if (isHost) {
      broadcastState(gameState);
    }
  }, [gameState, isHost]);


  // --- Client Logic ---

  const handleClientDataRef = useRef<(data: NetworkMessage) => void>(() => {});

  useEffect(() => {
      handleClientDataRef.current = (data: NetworkMessage) => {
        if (data.type === 'JOIN_ACCEPT') {
            setGameState(data.state);
            setMyPosition(data.yourPosition);
            setStatusMsg("");
        } else if (data.type === 'STATE_UPDATE') {
            setGameState(data.state);
        } else if (data.type === 'ACTION_EMOTE') {
            triggerEmote(data.position, data.emoji);
        } else if (data.type === 'ACTION_INTERACTION') {
            triggerInteraction(data.interactionType, data.from, data.to);
        } else if (data.type === 'ACTION_MESSAGE') {
            setSystemMessage(data.message);
        }
      };
  }); 

  const connectToHost = (hostId: string) => {
    if (!peerRef.current) return;
    setStatusMsg(TEXT.CONNECTING);
    
    const conn = peerRef.current.connect(hostId);
    
    conn.on('open', () => {
      setStatusMsg(TEXT.CONNECTED);
      conn.send({ type: 'JOIN_REQUEST', name: playerName });
    });

    conn.on('data', (data: NetworkMessage) => {
      handleClientDataRef.current(data);
    });

    connRef.current = conn;
  };

  const sendAction = (action: NetworkMessage) => {
    if (isHost) {
      if (action.type === 'ACTION_EMOTE') {
           broadcastMessage(action);
           triggerEmote(action.position, action.emoji);
           return;
      }
      if (action.type === 'ACTION_INTERACTION') {
           broadcastMessage(action);
           triggerInteraction(action.interactionType, action.from, action.to);
           return;
      }
      if (action.type === 'ACTION_REQUEST_REDEAL') {
           handleHostReceivedData(action, null); 
           return;
      }

      if (action.type === 'ACTION_BID') {
         setGameState(prev => processBidLogic(prev, action.bid));
      } else if (action.type === 'ACTION_DEAL') {
         startNewDeal(false);
      } else if (action.type === 'ACTION_RESTART') {
         startNewDeal(true);
      } else if (action.type === 'ACTION_READY') {
         setGameState(prev => processReadyLogic(prev, action.position));
      } else if (action.type === 'ACTION_PLAY') {
         setGameState(prev => processPlayLogic(prev, action.card, action.position));
      } else if (action.type === 'ACTION_SURRENDER') {
         setGameState(prev => processSurrender(prev, action.position));
      }
    } else {
      if (connRef.current && connRef.current.open) {
        connRef.current.send(action);
      }
    }
  };


  // --- Game Logic ---

  const processReadyLogic = (prev: GameState, position: PlayerPosition): GameState => {
      if (prev.phase !== GamePhase.Reviewing) return prev;
      if (prev.readyPlayers.includes(position)) return prev;

      const newReady = [...prev.readyPlayers, position];
      let nextPhase: GamePhase = prev.phase;
      
      if (newReady.length >= prev.players.length) {
          nextPhase = GamePhase.Bidding;
      }

      return { ...prev, readyPlayers: newReady, phase: nextPhase };
  };

  const processBidLogic = (prev: GameState, bid: Bid): GameState => {
      if (bid.player !== prev.turn) return prev;
      
      const newHistory = [...prev.bidHistory, bid];
      let nextTurn = NEXT_TURN[prev.turn];
      let newLastBid = prev.lastBid;
      if (bid.type === 'Bid') newLastBid = bid;

      let nextPhase = prev.phase;
      let contract = prev.contract;
      let declarer = prev.declarer;

      let passCount = 0;
      for (let i = newHistory.length - 1; i >= 0; i--) {
          if (newHistory[i].type === 'Pass') passCount++;
          else break;
      }

      if (newHistory.length === 4 && passCount === 4) {
          nextTurn = prev.dealer; 
          return { ...prev, bidHistory: newHistory, turn: nextTurn };
      }

      if (passCount === 3 && newHistory.length >= 4) {
          const lastBidObj = newHistory[newHistory.length - 4]; 
          if (lastBidObj && lastBidObj.type === 'Bid') {
              nextTurn = lastBidObj.player;
              return { ...prev, bidHistory: newHistory, turn: nextTurn };
          }
      }

      if (passCount === 4 && newHistory.length >= 5) {
          const winningBid = newHistory[newHistory.length - 5]; 
          
          if (winningBid && winningBid.type === 'Bid') {
                const winner = winningBid.player;
                const partner = PARTNER[winner];
                const winningSuit = winningBid.suit!;
                
                const firstBid = newHistory.find(b => 
                  b.type === 'Bid' && 
                  b.suit === winningSuit && 
                  (b.player === winner || b.player === partner)
                );
                
                const dec = firstBid ? firstBid.player : winner;
                contract = { level: winningBid.level!, suit: winningBid.suit!, declarer: dec };
                declarer = contract.declarer;
                nextPhase = GamePhase.Playing;
                nextTurn = NEXT_TURN[dec]; 
          }
      }

      return {
          ...prev,
          bidHistory: newHistory,
          turn: nextTurn,
          lastBid: newLastBid,
          phase: nextPhase,
          contract,
          declarer
      };
  };

  const processPlayLogic = (prev: GameState, card: Card, position: PlayerPosition): GameState => {
      if (prev.phase !== GamePhase.Playing) return prev;
      
      let currentTrick = [...prev.currentTrick];
      // Explicitly clone tricksWon to ensure React state updates trigger correctly
      let tricksWon: Record<PlayerPosition, number> = { ...prev.tricksWon };
      let playHistory = [...prev.playHistory];
      let newPhase: GamePhase = prev.phase;
      let winningTeam = prev.winningTeam;
      
      // LOGIC FIX: If the table is full (4 cards), this "play" action is the Winner of that trick leading the NEXT trick.
      // We must clear the previous trick and update scores BEFORE processing the new card.
      if (currentTrick.length === 4) {
          const winner = getTrickWinner(currentTrick, prev.contract?.suit);
          if (winner) {
              tricksWon[winner] = (tricksWon[winner] || 0) + 1;
              playHistory.push({
                  trickNumber: playHistory.length + 1,
                  cards: currentTrick,
                  winner: winner,
                  lead: currentTrick[0].player
              });
          }
          
          // CRITICAL: Check for game over *immediately* after score update, before new card is placed.
          const totalTricks = Object.values(tricksWon).reduce((a: number, b: number) => a + b, 0);
          if (totalTricks === 13) {
              // This shouldn't typically happen here (13th trick ends in the bottom block), but valid as safety.
              newPhase = GamePhase.Finished;
              const nsTricks = ((tricksWon[PlayerPosition.North] as number) || 0) + ((tricksWon[PlayerPosition.South] as number) || 0);
              const ewTricks = ((tricksWon[PlayerPosition.East] as number) || 0) + ((tricksWon[PlayerPosition.West] as number) || 0);
              const declarerIsNS = [PlayerPosition.North, PlayerPosition.South].includes(prev.contract!.declarer);
              const target = 6 + Number(prev.contract!.level);
              
              if (declarerIsNS) {
                  winningTeam = nsTricks >= target ? 'NS' : 'EW';
              } else {
                  winningTeam = ewTricks >= target ? 'EW' : 'NS';
              }
              
              return {
                  ...(prev as GameState),
                  tricksWon,
                  currentTrick: [], 
                  playHistory,
                  phase: newPhase,
                  winningTeam
              };
          }
          
          // If not game over, Clear the table for the new trick
          currentTrick = []; 
          
          // Validation: Ensure the person clearing (playing next) is the winner
          if (position !== winner) return prev;
      } else {
           if (prev.turn !== position) return prev;
      }

      // NOW: Process the new card being played
      const newHand = prev.hands[position].filter(c => c.id !== card.id);
      const newHands = { ...prev.hands, [position]: newHand };
      const newTrick = [...currentTrick, { card, player: position }];
      
      let nextTurn = NEXT_TURN[position];

      // End of Trick Logic (Standard & Final Trick)
      if (newTrick.length === 4) {
          const winner = getTrickWinner(newTrick, prev.contract?.suit);
          nextTurn = winner!;
          
          // Logic for the 13th Trick (Game End)
          // Since no one plays a 14th card, we must handle the game end HERE.
          const totalPlayed = playHistory.length + 1;
          if (totalPlayed === 13) {
               // Update score for the final trick immediately
               tricksWon[winner!] = (tricksWon[winner!] || 0) + 1;

               const finalHistory = [...playHistory, {
                   trickNumber: 13,
                   cards: newTrick,
                   winner: winner!,
                   lead: newTrick[0].player
               }];
               
               const nsTricks = ((tricksWon[PlayerPosition.North] as number) || 0) + ((tricksWon[PlayerPosition.South] as number) || 0);
               const ewTricks = ((tricksWon[PlayerPosition.East] as number) || 0) + ((tricksWon[PlayerPosition.West] as number) || 0);
               const declarerIsNS = [PlayerPosition.North, PlayerPosition.South].includes(prev.contract!.declarer);
               const target = 6 + Number(prev.contract!.level);
               let wTeam: 'NS'|'EW' = 'NS';

               if (declarerIsNS) wTeam = nsTricks >= target ? 'NS' : 'EW';
               else wTeam = ewTricks >= target ? 'EW' : 'NS';
               
               return {
                  ...(prev as GameState),
                  hands: newHands,
                  currentTrick: [], // Clear table immediately for end screen
                  tricksWon: tricksWon, // Return updated scores
                  playHistory: finalHistory,
                  phase: GamePhase.Finished,
                  winningTeam: wTeam
               };
          }
      }

      return {
          ...prev,
          hands: newHands,
          currentTrick: newTrick,
          tricksWon: tricksWon, // Ensure updated scores persist
          playHistory: playHistory, // Ensure history persists
          turn: nextTurn
      };
  };
  
  const processSurrender = (prev: GameState, position: PlayerPosition): GameState => {
      const isNS = [PlayerPosition.North, PlayerPosition.South].includes(position);
      const winningTeam = isNS ? 'EW' : 'NS';
      return {
          ...prev,
          phase: GamePhase.Finished,
          winningTeam,
          surrendered: true
      };
  };

  const startNewDeal = useCallback((isReplay: boolean = false) => {
    const currentState = gameStateRef.current;
    
    setHasRequestedRedeal(false);
    
    let nextDealer = currentState.dealer;
    let nextTurn = currentState.turn;

    if (isReplay && currentState.winningTeam) {
        const losers = currentState.winningTeam === 'NS' 
            ? [PlayerPosition.East, PlayerPosition.West]
            : [PlayerPosition.North, PlayerPosition.South];
        const randomLoser = losers[Math.floor(Math.random() * losers.length)];
        nextDealer = randomLoser;
        nextTurn = randomLoser;
    } else if (!isReplay) {
         const dealers = [PlayerPosition.North, PlayerPosition.East, PlayerPosition.South, PlayerPosition.West];
         const currentIdx = dealers.indexOf(currentState.dealer);
         nextDealer = dealers[(currentIdx + 1) % 4];
         nextTurn = nextDealer;
    }

    const deck = shuffleDeck(generateDeck());
    const hands = dealCards(deck);
    
    setGameState(prev => ({
      ...prev,
      phase: GamePhase.Dealing,
      hands,
      dealer: nextDealer,
      turn: nextTurn,
      vulnerability: { ns: Math.random() > 0.5, ew: Math.random() > 0.5 },
      bidHistory: [],
      lastBid: null,
      contract: null,
      declarer: null,
      readyPlayers: [],
      currentTrick: [],
      tricksWon: { [PlayerPosition.North]: 0, [PlayerPosition.East]: 0, [PlayerPosition.South]: 0, [PlayerPosition.West]: 0 },
      playHistory: [],
      winningTeam: undefined,
      surrendered: false
    }));

    setTimeout(() => {
        setGameState(prev => ({ ...prev, phase: GamePhase.Reviewing }));
    }, 1000);
  }, []); 


  const getPlayerInSlot = (slot: 'bottom' | 'left' | 'top' | 'right') => {
      if (!myPosition) return null;
      if (slot === 'bottom') return myPosition;
      if (slot === 'left') return NEXT_TURN[myPosition];
      if (slot === 'top') return PARTNER[myPosition];
      return [PlayerPosition.North, PlayerPosition.East, PlayerPosition.South, PlayerPosition.West].find(p => getRelativeSlot(p, myPosition) === slot);
  };
  
  let targetTricksDisplay = null;
  let canSurrender = false;
  
  if (gameState.contract && gameState.phase === GamePhase.Playing && myPosition) {
      const myPartner = PARTNER[myPosition];
      const isDeclarerSide = [gameState.contract.declarer, PARTNER[gameState.contract.declarer]].includes(myPosition);
      const level = Number(gameState.contract.level);
      
      const ourTricks = (gameState.tricksWon[myPosition] || 0) + (gameState.tricksWon[myPartner] || 0);
      const theirTricks = (Object.values(gameState.tricksWon) as number[]).reduce((a, b) => a + b, 0) - ourTricks;
      
      const declarerTarget = 6 + level;
      const defenderTarget = 14 - declarerTarget; 
      
      const myTarget = isDeclarerSide ? declarerTarget : defenderTarget;
      targetTricksDisplay = `${ourTricks}/${myTarget}`;

      const theyMetTarget = (isDeclarerSide && theirTricks >= defenderTarget) || (!isDeclarerSide && theirTricks >= declarerTarget);
      if (theyMetTarget) canSurrender = true;
  }
  
  const downloadHistory = () => {
      const data = {
          date: new Date().toISOString(),
          players: gameState.players,
          contract: gameState.contract,
          bidding: gameState.bidHistory,
          play: gameState.playHistory,
          result: gameState.tricksWon
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bridge_game_${new Date().getTime()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const getLightSuitColor = (suit: Suit | 'NT') => {
      if (suit === Suit.Spades || suit === Suit.Clubs) return 'text-gray-200';
      return SUIT_COLORS[suit];
  };

  const closePickers = () => {
      setShowEmotePicker(false);
      setShowItemPicker(false);
  };
  
  const cancelInteractionSelection = () => {
      setSelectedItemType(null);
  };

  const shouldDisablePass = () => {
      if (gameState.bidHistory.length === 4) {
          const allPass = gameState.bidHistory.every(b => b.type === 'Pass');
          if (allPass && gameState.turn === myPosition) return true;
      }
      return false;
  };

  const isPortrait = dimensions.height > dimensions.width;
  
  // Dynamic Screen Scaling
  // Instead of a fixed aspect ratio box (letterboxing), we use the smaller dimension to define scale
  // and let the other dimension expand.
  const BASE_SIZE = 768; // Base scale reference (768px matches typical tablet width or landscape height)
  
  let containerW = BASE_SIZE, containerH = BASE_SIZE, scaleFactor = 1;

  if (isPortrait) {
      // Portrait: Fix width, let height expand
      containerW = BASE_SIZE;
      scaleFactor = dimensions.width / containerW;
      containerH = dimensions.height / scaleFactor;
  } else {
      // Landscape: Fix height, let width expand
      containerH = BASE_SIZE;
      scaleFactor = dimensions.height / containerH;
      containerW = dimensions.width / scaleFactor;
  }

  // --- Render ---

  if (gameState.phase === GamePhase.Lobby) {
    return (
        <div className="min-h-screen bg-stone-900 flex items-center justify-center font-sans text-white p-4">
            <div className="max-w-md w-full bg-stone-800 p-8 rounded-xl shadow-2xl border border-stone-600">
                <h1 className="text-3xl font-bold text-center mb-2 text-yellow-500">♠️ {TEXT.GAME_TITLE}</h1>
                <p className="text-center text-gray-400 mb-8">{TEXT.SUBTITLE}</p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1 text-gray-300">{TEXT.NAME_LABEL}</label>
                        <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full bg-stone-900 border border-stone-700 rounded p-2 text-white focus:outline-none focus:border-yellow-500"/>
                    </div>
                    <div className="border-t border-stone-700 my-4 pt-4">
                        <button onClick={() => {
                            setMyPosition(PlayerPosition.North);
                            setGameState(prev => ({...prev, phase: GamePhase.Idle, players: [{ id: myPeerId, name: playerName, position: PlayerPosition.North, isHost: true }]}));
                        }} className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded mb-4 transition">{TEXT.HOST_GAME}</button>
                        <div className="flex gap-2">
                            <input type="text" placeholder={TEXT.ROOM_ID} value={hostPeerId} onChange={(e) => setHostPeerId(e.target.value)} className="flex-1 bg-stone-900 border border-stone-700 rounded p-2 text-white" />
                            <button onClick={() => connectToHost(hostPeerId)} disabled={!hostPeerId} className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded">{TEXT.JOIN_GAME}</button>
                        </div>
                    </div>
                    {statusMsg && <div className="text-center text-yellow-300 animate-pulse">{statusMsg}</div>}
                    <div className="text-xs text-center text-gray-500 mt-4">{TEXT.MY_ID}: <span className="select-all font-mono text-gray-300">{myPeerId || 'Initializing...'}</span></div>
                </div>
            </div>
        </div>
    );
  }

  const getProfile = (pos: PlayerPosition) => gameState.players.find(p => p.position === pos);
  
  const currentTrickWinner = getTrickWinner(gameState.currentTrick, gameState.contract?.suit);
  const isMyTurnToPlay = gameState.phase === GamePhase.Playing && gameState.turn === myPosition;

  const displayRoomId = isHost ? myPeerId : hostPeerId;
  const formattedRoomId = isPortrait && displayRoomId.length > 4 ? `${displayRoomId.slice(0, 2)}...${displayRoomId.slice(-2)}` : displayRoomId;

  return (
    <div className="fixed inset-0 bg-[#1a472a] overflow-hidden font-sans select-none w-screen h-[100dvh]">
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('https://www.transparenttextures.com/patterns/felt.png')]"></div>
    <div 
        style={{ 
            width: containerW, 
            height: containerH, 
            transform: `scale(${scaleFactor})`, 
            transformOrigin: 'top left'
        }}
        className="absolute top-0 left-0 overflow-hidden"
    >
      
      {(showEmotePicker || showItemPicker) && (
          <div className="absolute inset-0 z-40" onClick={closePickers}></div>
      )}

      {selectedItemType && (
          <div className="absolute inset-0 z-45 cursor-crosshair" onClick={cancelInteractionSelection}></div>
      )}

      {flyingItems.map(item => (
          <FlyingItemRenderer key={item.id} item={item} onComplete={() => setFlyingItems(prev => prev.filter(i => i.id !== item.id))} />
      ))}

      {systemMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] bg-black/70 px-8 py-4 rounded-full text-2xl text-yellow-300 font-bold animate-pulse pointer-events-none whitespace-nowrap">
              {systemMessage}
          </div>
      )}

      {/* Active Turn Highlights (Quadrants) */}
      {['bottom', 'left', 'top', 'right'].map(slot => {
          const pos = getPlayerInSlot(slot as any);
          if (!pos) return null;
          const isTurn = gameState.turn === pos && (gameState.phase === GamePhase.Playing || gameState.phase === GamePhase.Bidding);
          
          let bgClass = 'transition-opacity duration-500 absolute pointer-events-none z-0';
          if (slot === 'bottom') bgClass += ' bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-amber-500/40 to-transparent';
          if (slot === 'top') bgClass += ' top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-amber-500/40 to-transparent';
          if (slot === 'left') bgClass += ' left-0 top-0 bottom-0 w-1/3 bg-gradient-to-r from-amber-500/40 to-transparent';
          if (slot === 'right') bgClass += ' right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-amber-500/40 to-transparent';

          return <div key={`bg-${slot}`} className={`${bgClass} ${isTurn ? 'opacity-100' : 'opacity-0'}`}></div>;
      })}

      {/* Info Info */}
      {gameState.contract && (
         <div className={`absolute z-50 bg-black/60 border-yellow-500 p-4 text-white rounded backdrop-blur-md shadow-2xl ${isPortrait ? 'top-16 right-4 border-r-4 text-right' : 'bottom-4 left-4 border-l-4 text-left'}`}>
             <div className={`text-5xl font-bold flex items-center leading-none ${isPortrait ? 'justify-end' : ''}`}>
                 <span className="mr-2 text-gray-100">{TEXT.CONTRACT}:</span>
                 {gameState.contract.level}
                 <span className={`${getLightSuitColor(gameState.contract.suit)} ml-1`}>
                    {SUIT_SYMBOLS[gameState.contract.suit]}
                 </span>
             </div>
             <div className={`text-3xl font-bold mt-2 flex items-center ${isPortrait ? 'justify-end' : ''}`}>
                <span className="mr-2 text-gray-300">{TEXT.TRICKS}:</span>
                <span className="text-white">{targetTricksDisplay}</span>
             </div>
         </div>
      )}

      {/* Surrender Button */}
      {canSurrender && (
          <button 
            onClick={() => sendAction({ type: 'ACTION_SURRENDER', position: myPosition! })}
            className="absolute bottom-40 right-10 z-50 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded shadow-lg animate-bounce"
          >
              {TEXT.SURRENDER}
          </button>
      )}

      {/* Interaction Buttons (Bottom Right) */}
      <div className="absolute bottom-4 right-4 z-50 flex gap-4 pointer-events-auto">
          {/* Blue Frame - Emotes */}
          <div className="relative">
              <button 
                onClick={(e) => { 
                    e.stopPropagation(); 
                    setShowEmotePicker(!showEmotePicker); 
                    setShowItemPicker(false); 
                }} 
                className="w-16 h-16 rounded-full bg-blue-600 border-4 border-white shadow-xl flex items-center justify-center hover:bg-blue-500 transition"
              >
                <img src={ASSETS.EMOTES['😀']} className="w-10 h-10 object-contain" alt="emote"/>
              </button>
              {showEmotePicker && (
                  <div className="absolute bottom-20 right-0 bg-white p-2 rounded-xl shadow-2xl grid grid-cols-3 gap-2 w-64 border-4 border-blue-600 animate-fade-in-up z-50">
                      {EMOTES.map(emoji => (
                          <button key={emoji} onClick={() => handleEmote(emoji)} className="p-2 hover:bg-gray-100 rounded flex justify-center">
                              <img src={ASSETS.EMOTES[emoji]} className="w-12 h-12 object-contain" alt={emoji}/>
                          </button>
                      ))}
                  </div>
              )}
          </div>

          {/* Red Frame - Interactions */}
          <div className="relative">
              <button 
                onClick={(e) => { 
                    e.stopPropagation(); 
                    setShowItemPicker(!showItemPicker); 
                    setSelectedItemType(null); 
                    setShowEmotePicker(false); 
                }} 
                className={`w-16 h-16 rounded-full border-4 border-white shadow-xl flex items-center justify-center transition ${selectedItemType ? 'bg-red-800 animate-pulse' : 'bg-red-600 hover:bg-red-500'}`}
              >
                <img src={ASSETS.INTERACTIONS['FLOWER']} className="w-10 h-10 object-contain" alt="gift" />
              </button>
              {showItemPicker && !selectedItemType && (
                  <div className="absolute bottom-20 right-0 bg-white p-2 rounded-xl shadow-2xl flex flex-col gap-2 w-48 border-4 border-red-600 animate-fade-in-up z-50">
                      <button onClick={() => { setSelectedItemType('EGG'); setShowItemPicker(false); }} className="p-2 hover:bg-gray-100 rounded flex items-center gap-4">
                          <img src={ASSETS.INTERACTIONS['EGG']} className="w-12 h-12" alt="egg" />
                          <span className="text-lg font-bold text-black">{TEXT.EGG}</span>
                      </button>
                      <button onClick={() => { setSelectedItemType('FLOWER'); setShowItemPicker(false); }} className="p-2 hover:bg-gray-100 rounded flex items-center gap-4">
                          <img src={ASSETS.INTERACTIONS['FLOWER']} className="w-12 h-12" alt="flower" />
                          <span className="text-lg font-bold text-black">{TEXT.FLOWER}</span>
                      </button>
                  </div>
              )}
              {selectedItemType && (
                  <div className="absolute bottom-20 right-0 bg-black/80 text-white p-2 rounded-lg whitespace-nowrap font-bold text-lg">
                      {TEXT.CLICK_PLAYER_TO_SEND}
                  </div>
              )}
          </div>
      </div>

      {/* Header Info */}
      <div className="absolute top-0 left-0 w-full p-2 flex justify-between items-start z-50 pointer-events-none">
          <div className="bg-black/40 p-2 rounded pointer-events-auto backdrop-blur-sm cursor-pointer hover:bg-black/60 transition" onClick={() => copyRoomId(isHost ? myPeerId : hostPeerId)}>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  {TEXT.ROOM_ID}: 
                  <span className="text-yellow-400">{formattedRoomId}</span>
                  {!isPortrait && <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300 ml-2">{TEXT.CLICK_TO_COPY}</span>}
              </h1>
              {copyFeedback && <div className="text-green-400 text-sm font-bold mt-1 text-center">{copyFeedback}</div>}
          </div>
          {isHost && gameState.phase === GamePhase.Idle && (
              <div className="pointer-events-auto">
                   <button onClick={() => sendAction({type: 'ACTION_DEAL'})} className="bg-yellow-600 hover:bg-yellow-500 text-black px-8 py-4 rounded shadow font-bold text-2xl scale-[0.9] origin-top-right mr-20 mt-10">{TEXT.DEAL_CARDS}</button>
              </div>
          )}
      </div>

      {/* Main Table (Center) for Playing Cards */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
         <div className="relative w-[800px] h-[600px] pointer-events-auto">
             {gameState.currentTrick.map((tc) => {
                const relativeSlot = getRelativeSlot(tc.player, myPosition);
                let positionStyle: React.CSSProperties = { position: 'absolute', transition: 'all 0.5s ease-out' };
                
                // Position played cards
                if (relativeSlot === 'bottom') { positionStyle.bottom = '20%'; positionStyle.left = '50%'; positionStyle.transform = 'translateX(-50%)'; }
                if (relativeSlot === 'top') { positionStyle.top = '20%'; positionStyle.left = '50%'; positionStyle.transform = 'translateX(-50%)'; }
                if (relativeSlot === 'left') { positionStyle.left = '20%'; positionStyle.top = '50%'; positionStyle.transform = 'translateY(-50%)'; }
                if (relativeSlot === 'right') { positionStyle.right = '20%'; positionStyle.top = '50%'; positionStyle.transform = 'translateY(-50%)'; }
                
                const isWinning = currentTrickWinner === tc.player;
                return (
                    <div key={`${tc.player}-${tc.card.id}`} style={positionStyle}>
                        <CardComponent card={tc.card} highlighted={isWinning} />
                    </div>
                );
             })}
         </div>
      </div>

      {/* Bidding UI (Modified for Portrait) */}
      {gameState.phase === GamePhase.Bidding && (
          <div className={`absolute left-1/2 -translate-x-1/2 z-50 flex gap-4 animate-fade-in-up pointer-events-auto ${isPortrait ? 'flex-col bottom-[25%] scale-90' : 'flex-row bottom-[35%]'}`}>
             <AuctionBoard history={gameState.bidHistory} dealer={gameState.dealer} />
             <BiddingBox 
                onBid={(bid) => sendAction({ type: 'ACTION_BID', bid })} 
                history={gameState.bidHistory} 
                player={myPosition!} 
                disabled={gameState.turn !== myPosition}
                forceBid={shouldDisablePass()}
            />
          </div>
      )}
      
      {/* Ready / Reviewing UI */}
      {gameState.phase === GamePhase.Reviewing && (
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-stone-900/95 p-10 rounded-2xl border-2 border-yellow-500 text-center shadow-2xl pointer-events-auto">
                <h2 className="text-4xl font-bold mb-8 text-white">{TEXT.CHECK_HANDS}</h2>
                <div className="flex gap-8 justify-center mb-10">
                {gameState.players.map(p => (
                    <div key={p.position} className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full ${gameState.readyPlayers.includes(p.position) ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-2xl text-gray-400 mt-2">{TEXT[p.position]}</span>
                    </div>
                ))}
                </div>
                {!gameState.readyPlayers.includes(myPosition!) ? (
                    <div className="flex flex-col gap-4 items-center">
                        <button 
                            onClick={() => sendAction({ type: 'ACTION_READY', position: myPosition! })} 
                            disabled={hasRequestedRedeal}
                            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none text-white font-bold py-4 px-12 rounded-xl shadow-lg text-3xl transform hover:scale-105 transition"
                        >
                            {TEXT.READY}
                        </button>
                        <button onClick={handleRequestRedeal} className="text-gray-400 hover:text-white underline text-xl mt-4">
                            {TEXT.REQUEST_REDEAL}
                        </button>
                    </div>
                ) : (
                    <div className="text-yellow-400 text-2xl animate-pulse">{TEXT.WAITING_FOR_OTHERS}</div>
                )}
           </div>
      )}

      {/* Player Layout (Hands & Badges) */}
      {['top', 'left', 'right', 'bottom'].map((slot) => {
          const pos = getPlayerInSlot(slot as any);
          if (!pos) return null;
          
          const profile = getProfile(pos);
          const isTurn = gameState.turn === pos;
          const isActive = isTurn && (gameState.phase === GamePhase.Playing || gameState.phase === GamePhase.Bidding);
          const isDeclarer = gameState.contract?.declarer === pos;
          const isSideBadge = slot === 'left' || slot === 'right';
          
          let badgeClass = 'pointer-events-auto z-50 text-white text-3xl font-bold border-2 border-stone-600 shadow-xl backdrop-blur-md rounded-lg px-6 py-2 transition-all cursor-pointer relative';
          
          // Layout: Left/Right = Column (Name top, Pos bottom), Others = Row (Name left, Pos right)
          if (isSideBadge) badgeClass += ' flex flex-col items-center justify-center gap-1';
          else badgeClass += ' flex items-center gap-2';
          
          if (isActive) badgeClass += ' ring-4 ring-amber-500 bg-stone-700 scale-110';
          else badgeClass += ' bg-stone-800/80';
          
          if (selectedItemType) badgeClass += ' ring-4 ring-red-500 bg-red-900/50 scale-110 animate-pulse';

          const BadgeComponent = (
              <div className={badgeClass} onClick={(e) => { if(selectedItemType) { e.stopPropagation(); handleInteraction(pos); } }}>
                  <div className="whitespace-nowrap">{profile?.name}</div>
                  
                  <div className={`flex items-center gap-1 ${isSideBadge ? 'text-lg text-gray-300' : ''}`}>
                      {!isSideBadge && '('}
                      {TEXT[pos]}
                      {isDeclarer && <span className="text-yellow-400 text-4xl" title={TEXT.DECLARER}>👑</span>}
                      {!isSideBadge && ')'}
                  </div>
                  
                  {gameState.tricksWon[pos] > 0 && gameState.phase === GamePhase.Playing && (
                      <div className={`bg-yellow-500 text-black font-bold w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-lg text-xl ${isSideBadge ? 'mt-1' : 'ml-3'}`}>
                          {gameState.tricksWon[pos]}
                      </div>
                  )}
                  
                  {/* Active Emote Bubble */}
                  {activeEmotes[pos] && (
                      <div className={`absolute left-1/2 -translate-x-1/2 bg-white rounded-2xl p-2 shadow-2xl border-4 border-blue-500 animate-bounce z-50 ${(isPortrait && slot === 'top') ? 'top-full mt-2' : '-top-20'}`}>
                          <img src={ASSETS.EMOTES[activeEmotes[pos]]} className="w-16 h-16 object-contain" alt="emote"/>
                          {/* Triangle Arrow */}
                          <div className={`absolute left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-transparent ${(isPortrait && slot === 'top') ? '-top-[16px] border-b-[16px] border-b-white' : 'bottom-[-16px] border-t-[16px] border-t-white'}`}></div>
                      </div>
                  )}
              </div>
          );

          if (slot === 'bottom') {
              return (
                  <div key={pos} className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-end pb-4 pointer-events-none z-30">
                      <div className="mb-4 pointer-events-auto">{BadgeComponent}</div>
                      <div className="pointer-events-auto relative w-full flex justify-center">
                          <PlayerHand 
                              cards={gameState.hands[pos]} 
                              position={pos} 
                              isFaceUp={true} 
                              vertical={false}
                              currentTrick={gameState.currentTrick}
                              isMyTurn={isMyTurnToPlay}
                              trumpSuit={gameState.contract?.suit}
                              onPlayCard={(card) => sendAction({ type: 'ACTION_PLAY', card, position: pos })}
                          />
                      </div>
                  </div>
              );
          }
          
          if (slot === 'top') {
              return (
                  <div key={pos} className="absolute top-0 left-0 w-full flex flex-col items-center justify-start pt-4 pointer-events-none z-30">
                      <div className="mt-4 order-last pointer-events-auto">{BadgeComponent}</div>
                      <div className="pointer-events-auto relative w-full flex justify-center">
                           {(!isPortrait) && (
                                <PlayerHand 
                                    cards={gameState.hands[pos]} 
                                    position={pos} 
                                    isFaceUp={false} 
                                    vertical={false}
                                />
                           )}
                      </div>
                  </div>
              );
          }
          
          if (slot === 'left') {
               return (
                  <div key={pos} className="absolute left-0 top-0 h-full flex flex-row items-center pl-2 pointer-events-none z-30">
                      <div className="mr-8 whitespace-nowrap vertical-lr pointer-events-auto">{BadgeComponent}</div>
                      <div className="pointer-events-auto relative">
                           {(!isPortrait) && (
                                <PlayerHand cards={gameState.hands[pos]} position={pos} isFaceUp={false} vertical={true} />
                           )}
                      </div>
                  </div>
               );
          }
          
          if (slot === 'right') {
               return (
                  <div key={pos} className="absolute right-0 top-0 h-full flex flex-row-reverse items-center pr-2 pointer-events-none z-30">
                      <div className="ml-8 whitespace-nowrap vertical-lr pointer-events-auto">{BadgeComponent}</div>
                      <div className="pointer-events-auto relative">
                           {(!isPortrait) && (
                                <PlayerHand cards={gameState.hands[pos]} position={pos} isFaceUp={false} vertical={true} />
                           )}
                      </div>
                  </div>
               );
          }
          return null;
      })}
      
      {/* Game Over Modal */}
      {gameState.phase === GamePhase.Finished && (
          <div className="absolute inset-0 z-[100] bg-black/80 flex items-center justify-center">
              <div className={`p-10 rounded-2xl shadow-2xl max-w-4xl w-full border-4 ${gameState.winningTeam === (['North','South'].includes(myPosition!)?'NS':'EW') ? 'bg-green-900 border-green-500' : 'bg-red-900 border-red-500'}`}>
                  <h1 className="text-6xl font-bold text-center text-white mb-4">
                      {gameState.winningTeam === (['North','South'].includes(myPosition!)?'NS':'EW') ? TEXT.VICTORY : TEXT.DEFEAT}
                  </h1>
                  <h2 className="text-3xl text-center text-gray-300 mb-8">
                      {gameState.surrendered ? TEXT.OPPONENT_SURRENDERED : TEXT.GAME_FINISHED}
                  </h2>
                  
                  <div className="flex justify-around mb-8 text-2xl">
                      <div className="text-center p-4 bg-black/30 rounded">
                          <div className="text-blue-400 font-bold mb-2">{TEXT.TEAM_NS}</div>
                          <div className="text-4xl">{(gameState.tricksWon[PlayerPosition.North] || 0) + (gameState.tricksWon[PlayerPosition.South] || 0)}</div>
                      </div>
                      <div className="text-center p-4 bg-black/30 rounded">
                          <div className="text-red-400 font-bold mb-2">{TEXT.TEAM_EW}</div>
                          <div className="text-4xl">{(gameState.tricksWon[PlayerPosition.East] || 0) + (gameState.tricksWon[PlayerPosition.West] || 0)}</div>
                      </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-4 justify-center">
                      <button onClick={downloadHistory} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl text-2xl">
                          {TEXT.DOWNLOAD_LOG}
                      </button>
                      {isHost && (
                           <button onClick={() => sendAction({ type: 'ACTION_RESTART' })} className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-4 px-8 rounded-xl text-2xl">
                               {TEXT.PLAY_AGAIN}
                           </button>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
    </div>
  );
}

export default App;