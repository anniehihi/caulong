/* ==========================================================================
   SUPABASE INTEGRATION ENGINE FOR BADMINTON PENALTY TRACKER
   ========================================================================== */

(function () {
    let supabaseClient = null;
    let realtimeChannel = null;

    const DEFAULT_SUPABASE_URL = 'https://ecsoplptkzbkcdmseguc.supabase.co';
    const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjc29wbHB0a3pia2NkbXNlZ3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NDE2NTEsImV4cCI6MjEwMjIxNzY1MX0.v_OkNeWS8tRcp-CyaOixRKeHCOrRuG0MjN11POyIw5A';

    const SupabaseService = {
        getUrl() {
            return localStorage.getItem('badminton_supabase_url') || DEFAULT_SUPABASE_URL;
        },

        getKey() {
            return localStorage.getItem('badminton_supabase_key') || DEFAULT_SUPABASE_KEY;
        },

        saveCredentials(url, key) {
            localStorage.setItem('badminton_supabase_url', url.trim());
            localStorage.setItem('badminton_supabase_key', key.trim());
            return this.init();
        },

        isConfigured() {
            return !!(this.getUrl() && this.getKey() && window.supabase);
        },

        init() {
            const url = this.getUrl();
            const key = this.getKey();

            if (url && key && window.supabase) {
                try {
                    supabaseClient = window.supabase.createClient(url, key);
                    console.log("⚡ Supabase Client initialized successfully!");
                    return true;
                } catch (err) {
                    console.error("❌ Error initializing Supabase Client:", err);
                    supabaseClient = null;
                    return false;
                }
            }
            supabaseClient = null;
            return false;
        },

        getClient() {
            if (!supabaseClient) {
                this.init();
            }
            return supabaseClient;
        },

        // --- Data API Methods ---

        async fetchAppSettings() {
            const client = this.getClient();
            if (!client) return null;
            try {
                const { data, error } = await client
                    .from('app_settings')
                    .select('*')
                    .eq('key', 'default')
                    .maybeSingle();

                if (error) {
                    console.warn("Supabase fetchAppSettings warning:", error.message);
                    return null;
                }
                return data;
            } catch (err) {
                console.error("Supabase fetchAppSettings error:", err);
                return null;
            }
        },

        async saveAppSettings(shuttlePrice, bankConfig) {
            const client = this.getClient();
            if (!client) return false;
            try {
                const { error } = await client
                    .from('app_settings')
                    .upsert({
                        key: 'default',
                        shuttle_price: shuttlePrice,
                        bank_config: bankConfig,
                        updated_at: new Date().toISOString()
                    });

                if (error) console.error("Supabase saveAppSettings error:", error.message);
                return !error;
            } catch (err) {
                console.error("Supabase saveAppSettings error:", err);
                return false;
            }
        },

        async fetchPlayers() {
            const client = this.getClient();
            if (!client) return null;
            try {
                const { data, error } = await client
                    .from('players')
                    .select('*')
                    .order('created_at', { ascending: true });

                if (error) {
                    console.warn("Supabase fetchPlayers warning:", error.message);
                    return null;
                }
                return data;
            } catch (err) {
                console.error("Supabase fetchPlayers error:", err);
                return null;
            }
        },

        async savePlayer(name, penalties = 0) {
            const client = this.getClient();
            if (!client) return false;
            try {
                const { error } = await client
                    .from('players')
                    .upsert(
                        { name: name, penalties: penalties },
                        { onConflict: 'name' }
                    );

                if (error) console.error("Supabase savePlayer error:", error.message);
                return !error;
            } catch (err) {
                console.error("Supabase savePlayer error:", err);
                return false;
            }
        },

        async deletePlayer(name) {
            const client = this.getClient();
            if (!client) return false;
            try {
                const { error } = await client
                    .from('players')
                    .delete()
                    .eq('name', name);

                if (error) console.error("Supabase deletePlayer error:", error.message);
                return !error;
            } catch (err) {
                console.error("Supabase deletePlayer error:", err);
                return false;
            }
        },

        async fetchMatchHistory() {
            const client = this.getClient();
            if (!client) return null;
            try {
                const { data, error } = await client
                    .from('match_history')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (error) {
                    console.warn("Supabase fetchMatchHistory warning:", error.message);
                    return null;
                }
                return data;
            } catch (err) {
                console.error("Supabase fetchMatchHistory error:", err);
                return null;
            }
        },

        async addMatchHistory(match) {
            const client = this.getClient();
            if (!client) return false;
            try {
                const { error } = await client
                    .from('match_history')
                    .insert([{
                        mode: match.mode || '2v2',
                        winners: match.winners,
                        losers: match.losers,
                        penalty: match.penalty,
                        money: match.money,
                        created_at: new Date().toISOString()
                    }]);

                if (error) console.error("Supabase addMatchHistory error:", error.message);
                return !error;
            } catch (err) {
                console.error("Supabase addMatchHistory error:", err);
                return false;
            }
        },

        async resetAllData() {
            const client = this.getClient();
            if (!client) return false;
            try {
                // Reset penalties for all players
                const { error: err1 } = await client
                    .from('players')
                    .update({ penalties: 0 })
                    .neq('name', '');

                // Delete match history
                const { error: err2 } = await client
                    .from('match_history')
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000');

                if (err1) console.error("Reset players error:", err1);
                if (err2) console.error("Reset history error:", err2);
                return !err1 && !err2;
            } catch (err) {
                console.error("Supabase resetAllData error:", err);
                return false;
            }
        },

        // --- Real-time Listener ---

        subscribeRealtime(onDataChangedCallback) {
            const client = this.getClient();
            if (!client) return;

            if (realtimeChannel) {
                client.removeChannel(realtimeChannel);
            }

            realtimeChannel = client
                .channel('schema-db-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
                    console.log("⚡ Realtime update: players");
                    if (onDataChangedCallback) onDataChangedCallback('players');
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'match_history' }, () => {
                    console.log("⚡ Realtime update: match_history");
                    if (onDataChangedCallback) onDataChangedCallback('match_history');
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
                    console.log("⚡ Realtime update: app_settings");
                    if (onDataChangedCallback) onDataChangedCallback('app_settings');
                })
                .subscribe((status) => {
                    console.log("⚡ Supabase Realtime Subscription Status:", status);
                });
        }
    };

    window.SupabaseService = SupabaseService;
    SupabaseService.init();
})();
