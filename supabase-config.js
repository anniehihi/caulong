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

        getSupabaseLib() {
            return window.supabase || window.Supabase || (typeof supabase !== 'undefined' ? supabase : null);
        },

        isConfigured() {
            return !!(this.getUrl() && this.getKey() && this.getSupabaseLib());
        },

        init() {
            const url = this.getUrl();
            const key = this.getKey();
            const lib = this.getSupabaseLib();

            if (url && key && lib) {
                try {
                    supabaseClient = lib.createClient(url, key);
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

        handleError(actionName, error) {
            if (!error) return;
            console.error(`❌ Supabase ${actionName} error:`, error);
            if (error.code === '42501' || (error.message && error.message.includes('row-level security'))) {
                console.warn("⚠️ CẢNH BÁO RLS: Supabase đang bật Row Level Security. Vui lòng mở SQL Editor trên Supabase Dashboard và chạy lệnh DISABLE ROW LEVEL SECURITY.");
                if (typeof window.showToast === 'function') {
                    window.showToast("⚠️ Supabase bị chặn RLS! Mở 'Cài STK & Supabase' -> 'Lấy SQL Script' để mở quyền.");
                }
            }
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
                    this.handleError("fetchAppSettings", error);
                    return null;
                }
                return data;
            } catch (err) {
                console.error("Supabase fetchAppSettings error:", err);
                return null;
            }
        },

        async saveAppSettings(shuttlePrice, bankConfig, adminPin) {
            const client = this.getClient();
            if (!client) return false;
            try {
                const configToSave = Object.assign({}, bankConfig);
                if (adminPin) {
                    configToSave.adminPin = adminPin;
                }

                const payload = {
                    key: 'default',
                    shuttle_price: shuttlePrice,
                    bank_config: configToSave,
                    updated_at: new Date().toISOString()
                };

                if (adminPin) {
                    payload.admin_pin = adminPin;
                }

                const { error } = await client
                    .from('app_settings')
                    .upsert(payload);

                if (error) {
                    if (error.code === 'PGRST204' || (error.message && error.message.includes('admin_pin'))) {
                        delete payload.admin_pin;
                        const { error: fallbackErr } = await client
                            .from('app_settings')
                            .upsert(payload);
                        if (fallbackErr) this.handleError("saveAppSettings fallback", fallbackErr);
                    } else {
                        this.handleError("saveAppSettings", error);
                    }
                }
                return true;
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
                    this.handleError("fetchPlayers", error);
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

                if (error) this.handleError("savePlayer", error);
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

                if (error) this.handleError("deletePlayer", error);
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
                    this.handleError("fetchMatchHistory", error);
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

                if (error) this.handleError("addMatchHistory", error);
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
