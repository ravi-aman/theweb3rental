import { useEffect, useState } from "react";

const useGrokUrl = () => {
    const [grokUrl, setGrokUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchGrokUrl = async () => {
            try {
                const response = await fetch("/api/grok");
                if (!response.ok) throw new Error("Failed to fetch ngrok data");

                const data = await response.json();
                setGrokUrl(data.ngrok_url);
            } catch (error) {
                console.error("Error fetching ngrok URL:", error);
            }
        };

        fetchGrokUrl();
    }, []);

    return grokUrl;
};

export default useGrokUrl;
