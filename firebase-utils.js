// firebase-utils.js - Catchmon Firebase Integration
// Diese Datei ersetzt alle fetch() Aufrufe zu JSON-Dateien

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getDatabase, 
    ref, 
    onValue, 
    set, 
    update, 
    push, 
    get,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// 🔥 FIREBASE KONFIGURATION - ERSETZE MIT DEINEN ECHTEN DATEN!
const firebaseConfig = {
    apiKey: "deine-api-key",
    authDomain: "catchmon-12345.firebaseapp.com", 
    databaseURL: "https://catchmon-12345-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "catchmon-12345",
    storageBucket: "catchmon-12345.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// Firebase initialisieren
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🎮 CATCHMON FIREBASE UTILITIES
class CatchmonFirebase {
    constructor() {
        this.db = db;
        this.listeners = new Map(); // Track active listeners
    }

    // 📡 SPAWN SYSTEM
    
    // Live-Updates für aktuellen Spawn
    watchCurrentSpawn(callback) {
        const spawnRef = ref(this.db, 'spawn/current');
        const unsubscribe = onValue(spawnRef, (snapshot) => {
            const data = snapshot.val();
            callback(data || {});
        });
        
        this.listeners.set('spawn', unsubscribe);
        return unsubscribe;
    }

    // Neuen Spawn setzen
    async setCurrentSpawn(spawnData) {
        const spawnRef = ref(this.db, 'spawn/current');
        const spawnWithTimestamp = {
            ...spawnData,
            timestamp: Date.now(),
            result: null,
            winner: null
        };
        
        await set(spawnRef, spawnWithTimestamp);
        console.log('🎯 New spawn set:', spawnData.name);
        return spawnWithTimestamp;
    }

    // Spawn-Ergebnis setzen (caught/escaped)
    async setSpawnResult(result, winner = null) {
        const spawnRef = ref(this.db, 'spawn/current');
        const updates = {
            result: result, // 'caught' oder 'escaped'
            winner: winner,
            timestamp_result: Date.now()
        };
        
        await update(spawnRef, updates);
        console.log(`🎉 Spawn result: ${result}${winner ? ` by ${winner}` : ''}`);
    }

    // 👤 TRAINER SYSTEM

    // Live-Updates für alle Trainer
    watchTrainers(callback) {
        const trainersRef = ref(this.db, 'trainers');
        const unsubscribe = onValue(trainersRef, (snapshot) => {
            const data = snapshot.val() || {};
            callback(data);
        });
        
        this.listeners.set('trainers', unsubscribe);
        return unsubscribe;
    }

    // Einzelnen Trainer beobachten
    watchTrainer(username, callback) {
        const trainerRef = ref(this.db, `trainers/${username}`);
        const unsubscribe = onValue(trainerRef, (snapshot) => {
            const data = snapshot.val() || { coins: 0, team: [], donation: 0 };
            callback(data);
        });
        
        this.listeners.set(`trainer_${username}`, unsubscribe);
        return unsubscribe;
    }

    // Catchmon zu Trainer hinzufügen
    async addCatchmonToTrainer(username, catchmon) {
        const trainerRef = ref(this.db, `trainers/${username}`);
        
        // Aktuelle Trainerdaten laden
        const snapshot = await get(trainerRef);
        const trainerData = snapshot.val() || { coins: 0, team: [], donation: 0 };
        
        // Catchmon hinzufügen
        const updatedTeam = [...(trainerData.team || []), catchmon];
        const updates = {
            ...trainerData,
            team: updatedTeam,
            coins: (trainerData.coins || 0) + 10 // Belohnung für Fang
        };
        
        await set(trainerRef, updates);
        console.log(`✅ Added ${catchmon.name} to ${username}'s team`);
        
        // Global Stats aktualisieren
        await this.updateGlobalStats({
            total_catches: 1,
            [`catches_by_${username}`]: 1
        });
        
        return updates;
    }

    // Trainer-Spende aktualisieren
    async updateTrainerDonation(username, donationAmount) {
        const trainerRef = ref(this.db, `trainers/${username}`);
        const updates = {
            donation: donationAmount,
            last_donation_timestamp: Date.now()
        };
        
        await update(trainerRef, updates);
        console.log(`💰 Updated donation for ${username}: ${donationAmount}`);
    }

    // 💓 LIKE SYSTEM

    // Live-Updates für Like-Zähler
    watchLikes(callback) {
        const likesRef = ref(this.db, 'likes');
        const unsubscribe = onValue(likesRef, (snapshot) => {
            const data = snapshot.val() || {};
            callback(data);
        });
        
        this.listeners.set('likes', unsubscribe);
        return unsubscribe;
    }

    // Like für User hinzufügen
    async addLike(username) {
        const userLikesRef = ref(this.db, `likes/${username}`);
        
        // Aktuelle Likes laden
        const snapshot = await get(userLikesRef);
        const currentLikes = snapshot.val() || 0;
        const newLikes = Math.min(currentLikes + 1, 1000); // Max 1000 Likes
        
        await set(userLikesRef, newLikes);
        
        // Global Like-Counter aktualisieren
        await this.incrementGlobalStat('total_likes', 1);
        
        return newLikes;
    }

    // Likes für aktuellen Spawn zurücksetzen
    async resetLikes() {
        await set(ref(this.db, 'likes'), {});
        console.log('🔄 Likes reset for new spawn');
    }

    // 📊 GLOBAL STATISTICS

    // Live-Updates für globale Stats
    watchGlobalStats(callback) {
        const globalRef = ref(this.db, 'global');
        const unsubscribe = onValue(globalRef, (snapshot) => {
            const data = snapshot.val() || {};
            callback(data);
        });
        
        this.listeners.set('global', unsubscribe);
        return unsubscribe;
    }

    // Globale Stats aktualisieren
    async updateGlobalStats(updates) {
        const globalRef = ref(this.db, 'global');
        
        // Aktuelle Stats laden
        const snapshot = await get(globalRef);
        const currentStats = snapshot.val() || {};
        
        // Updates zusammenführen
        const newStats = { ...currentStats };
        for (const [key, value] of Object.entries(updates)) {
            if (typeof value === 'number' && typeof currentStats[key] === 'number') {
                newStats[key] = currentStats[key] + value;
            } else {
                newStats[key] = value;
            }
        }
        
        await set(globalRef, newStats);
        return newStats;
    }

    // Einzelnen globalen Stat erhöhen
    async incrementGlobalStat(statName, increment = 1) {
        const statRef = ref(this.db, `global/${statName}`);
        const snapshot = await get(statRef);
        const currentValue = snapshot.val() || 0;
        const newValue = currentValue + increment;
        
        await set(statRef, newValue);
        return newValue;
    }

    // Höchstes Level Catchmon aktualisieren
    async updateHighestLevelCatchmon(name, level, catcher) {
        const highestRef = ref(this.db, 'global/highest_level_catchmon');
        const snapshot = await get(highestRef);
        const current = snapshot.val() || { level: 0 };
        
        if (level > current.level) {
            const newRecord = { name, level, catcher, timestamp: Date.now() };
            await set(highestRef, newRecord);
            console.log(`🏆 NEW HIGHEST LEVEL: ${name} Level ${level} by ${catcher}!`);
            return true;
        }
        return false;
    }

    // 🏃‍♂️ ESCAPED CATCHMON

    // Entkommenes Catchmon hinzufügen
    async addEscapedCatchmon(catchmon) {
        const escapedRef = ref(this.db, 'escaped');
        const snapshot = await get(escapedRef);
        const currentEscaped = snapshot.val() || [];
        
        const escapedCatchmon = {
            ...catchmon,
            escaped_timestamp: Date.now()
        };
        
        const updatedEscaped = [...currentEscaped, escapedCatchmon];
        await set(escapedRef, updatedEscaped);
        
        // Global Stats aktualisieren
        await this.incrementGlobalStat('total_escapes', 1);
        
        console.log(`🏃‍♂️ ${catchmon.name} escaped!`);
        return updatedEscaped;
    }

    // Live-Updates für entkommene Catchmon
    watchEscaped(callback) {
        const escapedRef = ref(this.db, 'escaped');
        const unsubscribe = onValue(escapedRef, (snapshot) => {
            const data = snapshot.val() || [];
            callback(data);
        });
        
        this.listeners.set('escaped', unsubscribe);
        return unsubscribe;
    }

    // 🎯 CATCH CALCULATION

    // Fangchance berechnen basierend auf Likes und Donations
    async calculateCatchWinner() {
        const likesSnapshot = await get(ref(this.db, 'likes'));
        const trainersSnapshot = await get(ref(this.db, 'trainers'));
        
        const likes = likesSnapshot.val() || {};
        const trainers = trainersSnapshot.val() || {};
        
        // Effektive Likes berechnen (Likes × Donation-Multiplier)
        const effectiveLikes = {};
        let totalEffectiveLikes = 0;
        
        for (const [username, userLikes] of Object.entries(likes)) {
            const donation = trainers[username]?.donation || 0;
            const multiplier = this.getDonationMultiplier(donation);
            const effective = Math.min(userLikes * multiplier, 1000); // Max 1000 effektive Likes
            
            effectiveLikes[username] = effective;
            totalEffectiveLikes += effective;
        }
        
        if (totalEffectiveLikes === 0) {
            return null; // Niemand hat Likes
        }
        
        // Zufälligen Gewinner basierend auf Wahrscheinlichkeiten wählen
        const random = Math.random() * totalEffectiveLikes;
        let accumulator = 0;
        
        for (const [username, effective] of Object.entries(effectiveLikes)) {
            accumulator += effective;
            if (random <= accumulator) {
                return {
                    winner: username,
                    effectiveLikes: effective,
                    totalEffectiveLikes,
                    chance: (effective / totalEffectiveLikes * 100).toFixed(1)
                };
            }
        }
        
        return null;
    }

    // Donation-Multiplier berechnen
    getDonationMultiplier(donation) {
        if (donation >= 20) return 4;
        if (donation >= 10) return 3;
        if (donation >= 5) return 2;
        return 1;
    }

    // 🔄 UTILITY FUNCTIONS

    // Alle Listener stoppen
    stopAllListeners() {
        for (const [key, unsubscribe] of this.listeners) {
            unsubscribe();
            console.log(`🔇 Stopped listener: ${key}`);
        }
        this.listeners.clear();
    }

    // Einzelnen Listener stoppen
    stopListener(key) {
        const unsubscribe = this.listeners.get(key);
        if (unsubscribe) {
            unsubscribe();
            this.listeners.delete(key);
            console.log(`🔇 Stopped listener: ${key}`);
        }
    }

    // Komplette Datenbank-Struktur initialisieren
    async initializeDatabase() {
        const initialData = {
            spawn: {
                current: {
                    name: "Pikachu",
                    sprite: "catchmon/Starter/Pikachu.png",
                    level: 1,
                    rarity: "Starter",
                    shiny: false,
                    timestamp: Date.now(),
                    result: null,
                    winner: null,
                    stats: {
                        hp: 35,
                        attack: 55,
                        defense: 40,
                        speed: 90
                    }
                }
            },
            trainers: {},
            global: {
                total_likes: 0,
                total_spawns: 1,
                total_catches: 0,
                total_escapes: 0,
                highest_level_catchmon: {
                    name: "None",
                    level: 0,
                    catcher: "None"
                }
            },
            likes: {},
            escaped: []
        };
        
        await set(ref(this.db, '/'), initialData);
        console.log('🔥 Database initialized with default structure');
        return initialData;
    }

    // Daten aus alten JSON-Dateien migrieren
    async migrateFromJSON() {
        console.log('🔄 Starting JSON migration...');
        
        const migrationResults = {
            success: [],
            failed: [],
            migratedData: {}
        };
        
        // spawn_data.json migrieren
        try {
            const spawnResponse = await fetch('spawn_data.json?' + Date.now());
            if (spawnResponse.ok) {
                const spawnData = await spawnResponse.json();
                migrationResults.migratedData.spawn = { current: spawnData };
                migrationResults.success.push('spawn_data.json');
            }
        } catch (error) {
            migrationResults.failed.push(`spawn_data.json: ${error.message}`);
        }
        
        // catcher.json migrieren
        try {
            const catcherResponse = await fetch('catcher.json?' + Date.now());
            if (catcherResponse.ok) {
                const catcherData = await catcherResponse.json();
                migrationResults.migratedData.trainers = catcherData.catcher || {};
                migrationResults.migratedData.escaped = catcherData.escaped || [];
                migrationResults.success.push('catcher.json');
            }
        } catch (error) {
            migrationResults.failed.push(`catcher.json: ${error.message}`);
        }
        
        // global_stats.json migrieren
        try {
            const globalResponse = await fetch('global_stats.json?' + Date.now());
            if (globalResponse.ok) {
                const globalData = await globalResponse.json();
                migrationResults.migratedData.global = globalData;
                migrationResults.success.push('global_stats.json');
            }
        } catch (error) {
            migrationResults.failed.push(`global_stats.json: ${error.message}`);
        }
        
        // Migrierte Daten in Firebase schreiben
        if (migrationResults.success.length > 0) {
            // Likes-Counter initialisieren
            migrationResults.migratedData.likes = {};
            
            await set(ref(this.db, '/'), migrationResults.migratedData);
            console.log(`✅ Migration completed: ${migrationResults.success.length} files migrated`);
        }
        
        return migrationResults;
    }

    // Debug: Aktuelle Datenbankstruktur anzeigen
    async debugDatabase() {
        const snapshot = await get(ref(this.db, '/'));
        const data = snapshot.val();
        console.log('🔍 Current Database Structure:', data);
        return data;
    }
}

// 🌟 EINFACHE WRAPPER-FUNKTIONEN für bestehenden Code

// Globale CatchmonFirebase Instanz
const catchmonDB = new CatchmonFirebase();

// Legacy-Funktionen für einfache Migration bestehender HTML-Dateien
window.loadSpawnData = function(callback) {
    console.warn('⚠️ loadSpawnData() is deprecated. Use catchmonDB.watchCurrentSpawn() instead');
    return catchmonDB.watchCurrentSpawn(callback);
};

window.loadCatcherData = function(callback) {
    console.warn('⚠️ loadCatcherData() is deprecated. Use catchmonDB.watchTrainers() instead');
    return catchmonDB.watchTrainers((trainers) => {
        // Konvertiere zu altem Format für Kompatibilität
        callback({ catcher: trainers });
    });
};

window.loadGlobalStats = function(callback) {
    console.warn('⚠️ loadGlobalStats() is deprecated. Use catchmonDB.watchGlobalStats() instead');
    return catchmonDB.watchGlobalStats(callback);
};

// Globale Verfügbarkeit
window.catchmonDB = catchmonDB;
window.CatchmonFirebase = CatchmonFirebase;

console.log('🔥 Catchmon Firebase Utils loaded successfully!');
console.log('📖 Usage: catchmonDB.watchCurrentSpawn((data) => { /* your code */ })');

export { CatchmonFirebase, catchmonDB };