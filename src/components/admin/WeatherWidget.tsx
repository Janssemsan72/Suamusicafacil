import { useEffect, useState } from "react";
import { Cloud, CloudRain, Sun, CloudSun, Droplets, Wind } from "@/lib/icons";

interface WeatherData {
  temp: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
}

export function WeatherWidget() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  // Atualizar hora a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Buscar dados do clima
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Usando OpenWeatherMap API (gratuita)
        // Fortaleza: lat=-3.7172, lon=-38.5433
        const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || "demo";
        
        // Se não tiver API key, usar dados mockados
        if (API_KEY === "demo" || !API_KEY) {
          // Dados mockados para demonstração
          setWeather({
            temp: 28,
            description: "Parcialmente nublado",
            humidity: 75,
            windSpeed: 15,
            icon: "partly-cloudy"
          });
          setLoading(false);
          return;
        }

        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=-3.7172&lon=-38.5433&units=metric&lang=pt_br&appid=${API_KEY}`
        );

        if (response.ok) {
          const data = await response.json();
          setWeather({
            temp: Math.round(data.main.temp),
            description: data.weather[0].description,
            humidity: data.main.humidity,
            windSpeed: Math.round(data.wind.speed * 3.6), // converter m/s para km/h
            icon: data.weather[0].icon
          });
        } else {
          // Fallback para dados mockados em caso de erro
          setWeather({
            temp: 28,
            description: "Parcialmente nublado",
            humidity: 75,
            windSpeed: 15,
            icon: "partly-cloudy"
          });
        }
      } catch (error) {
        console.error("Erro ao buscar clima:", error);
        // Fallback para dados mockados
        setWeather({
          temp: 28,
          description: "Parcialmente nublado",
          humidity: 75,
          windSpeed: 15,
          icon: "partly-cloudy"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    // Atualizar clima a cada 10 minutos
    const interval = setInterval(fetchWeather, 600000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  };

  const getWeatherIcon = (icon: string, label: string) => {
    const ariaLabel = label || "Clima";
    if (icon.includes("01")) return <Sun aria-label={ariaLabel} className="h-4 w-4 text-white/95" />;
    if (icon.includes("02")) return <CloudSun aria-label={ariaLabel} className="h-4 w-4 text-white/95" />;
    if (icon.includes("03") || icon.includes("04")) return <Cloud aria-label={ariaLabel} className="h-4 w-4 text-white/95" />;
    if (icon.includes("09") || icon.includes("10")) return <CloudRain aria-label={ariaLabel} className="h-4 w-4 text-white/95" />;
    return <CloudSun aria-label={ariaLabel} className="h-4 w-4 text-white/95" />;
  };

  return (
    <div className="hidden xl:flex items-center gap-4 text-white/95">
      {/* Data e Hora */}
      <div className="flex flex-col items-center">
        <div className="text-[10px] font-medium text-white/80 leading-tight tracking-wide uppercase">
          {formatDate(currentTime)}
        </div>
        <div className="text-sm font-semibold text-white tabular-nums tracking-tight mt-0.5">
          {formatTime(currentTime)}
        </div>
      </div>

      {/* Separador */}
      <div className="h-8 w-px bg-white/20" />

      {/* Clima */}
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
          <span className="text-xs text-white/80">Carregando...</span>
        </div>
      ) : weather ? (
        <>
          <div className="flex items-center gap-2">
            <div className="text-white/95">
              {getWeatherIcon(weather.icon, weather.description)}
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-0.5">
                <span className="text-base font-semibold text-white tracking-tight">
                  {weather.temp}
                </span>
                <span className="text-[10px] text-white/80">°C</span>
              </div>
              <div className="text-[9px] text-white/80 capitalize leading-tight max-w-[85px] truncate">
                {weather.description}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-[9px] text-white/80 pl-2 border-l border-white/20">
            <div className="flex items-center gap-1">
              <Droplets className="h-3 w-3 text-white/80" />
              <span>{weather.humidity}%</span>
            </div>
            <div className="flex items-center gap-1">
              <Wind className="h-3 w-3 text-white/80" />
              <span>{weather.windSpeed}km/h</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
