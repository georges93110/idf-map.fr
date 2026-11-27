// x86 adapter for the installed ELAN mtsyc32.dll 5.1 (2004).
// The UI runs every render in its own disposable process. No server, COM
// registration, installed binary, registry value or system clock is changed.
#include <windows.h>
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <string>
#include <atomic>
#include <stdexcept>
#include <cmath>

namespace {
template<class T> T symbol(HMODULE module, const char* name) {
    auto p = GetProcAddress(module, name);
    if (!p) throw std::runtime_error("Fonction ELAN absente dans la bibliotheque installee.");
    return reinterpret_cast<T>(p);
}
std::string narrow(const wchar_t* value, unsigned codepage) {
    BOOL substituted = FALSE;
    int size = WideCharToMultiByte(codepage, WC_NO_BEST_FIT_CHARS, value, -1, nullptr, 0, nullptr, &substituted);
    if (!size) throw std::runtime_error("Encodage du texte non pris en charge.");
    std::string out(size, '\0');
    WideCharToMultiByte(codepage, WC_NO_BEST_FIT_CHARS, value, -1, &out[0], size, nullptr, &substituted);
    if (substituted) throw std::runtime_error("Le texte contient un caractere non pris en charge par cette ancienne voix. Retirez notamment les emojis.");
    out.pop_back(); return out;
}
struct VoicePaths {
    std::string data;
    virtual int Resolve(const char*, char* output, int capacity) {
        std::string command = "/d \"" + data + "\"";
        return strncpy_s(output, capacity, command.c_str(), _TRUNCATE) == 0;
    }
};
struct Sink {
    FILE* file = nullptr;
    int volume = 100;
    std::atomic<unsigned> bytes{0};
    std::atomic<bool> ready{false}, idle{false}, failed{false};
    virtual int Reserved0() { return 1; }
    virtual int Post(unsigned message, unsigned, unsigned value) {
        if (message == 0x487) { if (value == 1) ready = true; else failed = true; }
        if (message == 0x48c && static_cast<int>(value) < 0) failed = true;
        if (message == 0x482 && bytes.load() > 0) idle = true;
        return 1;
    }
    virtual int Send(unsigned message, unsigned, void* param, unsigned, unsigned, unsigned* result) {
        if (message == WM_COPYDATA && param) {
            auto block = static_cast<COPYDATASTRUCT*>(param);
            // Type 1 carries signed 16-bit PCM; type 3 carries notifications.
            if (block->dwData == 1 && block->lpData && block->cbData) {
                if (block->cbData > 16*1024*1024 || block->cbData % 2 || !file) { failed = true; return 0; }
                auto samples = static_cast<const int16_t*>(block->lpData);
                unsigned count = block->cbData / 2;
                if (volume == 100) {
                    if (fwrite(samples, 2, count, file) != count) failed = true;
                } else {
                    for (unsigned i=0; i<count; ++i) {
                        int16_t sample = static_cast<int16_t>(static_cast<int>(samples[i]) * volume / 100);
                        if (fwrite(&sample, 2, 1, file) != 1) { failed = true; break; }
                    }
                }
                bytes += block->cbData;
                idle = false;
            }
        }
        // Sink status: writable (bit 1), with 65536 bytes of free capacity.
        if (result) *result = message == 0x477 ? 0x02010000u : 0u;
        return failed ? 0 : 1;
    }
    virtual int Reset(void*, unsigned) { return 1; }
    virtual int Reserved4() { return 1; }
    virtual int Reserved5() { return 1; }
    virtual int IsConnected() { return 1; }
    virtual int Reserved7() { return 1; }
};
int __cdecl HostVoice(const char*, int, int, int, int) { return 1; }
int __cdecl FileThroughput() { return 999; } // Offline file sink; no playback pacing.
void write16(FILE* f, uint16_t value) { fwrite(&value,2,1,f); }
void write32(FILE* f, uint32_t value) { fwrite(&value,4,1,f); }
void header(FILE* f, unsigned hz, unsigned bytes) {
    fseek(f,0,SEEK_SET);
    fwrite("RIFF",1,4,f); write32(f,36+bytes); fwrite("WAVEfmt ",1,8,f);
    write32(f,16); write16(f,1); write16(f,1); write32(f,hz);
    write32(f,hz*2); write16(f,2); write16(f,16);
    fwrite("data",1,4,f); write32(f,bytes);
}
}

extern "C" __declspec(dllexport) int __cdecl RenderElanV2(
    const wchar_t* bin, const wchar_t* data, const wchar_t* voice,
    const wchar_t* text, const wchar_t* output, int codepage, int speedPercent, int pitchPercent, int volume,
    char* error, int errorCapacity) {
    SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
    // Keep callbacks and objects alive until the dedicated render process exits.
    // This also contains any failure of the legacy engine to release a thread.
    auto sink = new Sink();
    auto paths = new VoicePaths();
    auto object = new char[0x2000]();
    try {
        paths->data = narrow(data, CP_ACP);
        if (paths->data.size() > 450) throw std::runtime_error("Chemin des donnees vocales trop long pour ELAN.");
        std::string name = narrow(voice, CP_ACP), input = narrow(text, codepage);
        if (name.size() >= 255 || input.empty()) throw std::runtime_error("Voix ou texte invalide.");
        SetDllDirectoryW(bin);
        HMODULE module = LoadLibraryW((std::wstring(bin)+L"\\mtsyc32.dll").c_str());
        if (!module) throw std::runtime_error("Impossible de charger mtsyc32.dll et ses dependances.");
        using MetaCtor = void*(__thiscall*)(void*);
        using MetaLoad = int(__thiscall*)(void*,const char*);
        using Dispose = void(__thiscall*)(void*);
        char metadataObject[64] = {};
        symbol<MetaCtor>(module,"??0CStadModeInfo@@QAE@XZ")(metadataObject);
        if (symbol<MetaLoad>(module,"?LoadStad@CStadModeInfo@@QAEHPBD@Z")(metadataObject,paths->data.c_str()) < 1)
            throw std::runtime_error("Les donnees de cette voix ne peuvent pas etre chargees.");
        auto metadata = *reinterpret_cast<unsigned char**>(metadataObject+8);
        unsigned hz = *reinterpret_cast<unsigned*>(metadata+0xafc);
        symbol<Dispose>(module,"?UnloadStad@CStadModeInfo@@QAEXXZ")(metadataObject);
        if (hz < 8000 || hz > 48000) throw std::runtime_error("Frequence audio ELAN non reconnue.");
        if (_wfopen_s(&sink->file,output,L"wb") || !sink->file) throw std::runtime_error("Impossible de creer le fichier audio.");
        header(sink->file,hz,0);
        sink->volume = volume < 0 ? 0 : (volume > 100 ? 100 : volume);
        using Ctor = void*(__thiscall*)(void*,void*,void**,unsigned,void*);
        using Register = int(__thiscall*)(void*,void*);
        using Open = int(__thiscall*)(void*,void*,void*,unsigned,void*);
        using Get = int(__thiscall*)(void*,unsigned);
        using Request = int(__thiscall*)(void*,unsigned,char,int);
        using Say = int(__thiscall*)(void*,unsigned,char*,int);
        void* functions[2] = { reinterpret_cast<void*>(&HostVoice),
            reinterpret_cast<void*>(reinterpret_cast<uintptr_t>(&HostVoice)^reinterpret_cast<uintptr_t>(&FileThroughput)) };
        symbol<Ctor>(module,"??0CWpsolaThread@@QAE@PAVCAbstractLineStatus@@QAPAXKPAVCModeInfo@@@Z")(object,nullptr,functions,0,paths);
        if (!symbol<Register>(module,"?wpsolaRegister@CWpsolaThread@@QAEHPAVCSpeechNotifySink@@@Z")(object,sink))
            throw std::runtime_error("Impossible d'initialiser la sortie audio.");
        char config[0x10c]={}; *reinterpret_cast<unsigned*>(config)=sizeof(config);
        strcpy_s(config+4,256,name.c_str());
        if (!symbol<Open>(module,"?wpsolaOpen@CWpsolaThread@@QAEHPAX0K0@Z")(object,nullptr,config,0,nullptr))
            throw std::runtime_error("Impossible d'ouvrir cette voix ELAN.");
        ULONGLONG start=GetTickCount64();
        while (!sink->ready && !sink->failed && GetTickCount64()-start<10000) Sleep(10);
        if (!sink->ready || sink->failed) throw std::runtime_error("Le moteur ELAN n'a pas charge cette voix.");
        auto status=symbol<Get>(module,"?wpsolaGetStatus@CWpsolaThread@@QAEHK@Z");
        speedPercent = speedPercent < 30 ? 30 : (speedPercent > 200 ? 200 : speedPercent);
        pitchPercent = pitchPercent < 30 ? 30 : (pitchPercent > 200 ? 200 : pitchPercent);
        // The SAPI absolute-value setters require caches filled by the old host.
        // A fresh native channel accepts duration variation (Q) and pitch ratio (p).
        auto request=symbol<Request>(module,"?wpsolaSendRqt@CWpsolaThread@@QAEHKDH@Z");
        int durationChange=(10000 + speedPercent/2)/speedPercent-100;
        if (speedPercent != 100 && request(object,0,'Q',durationChange) != 1)
            throw std::runtime_error("Le moteur ELAN n'a pas accepte la vitesse.");
        if (pitchPercent != 100 && request(object,0,'p',pitchPercent) != 1)
            throw std::runtime_error("Le moteur ELAN n'a pas accepte le pitch.");
        sink->idle=false;
        if (symbol<Say>(module,"?wpsolaSayText@CWpsolaThread@@QAEHKPADH@Z")(object,0,&input[0],static_cast<int>(input.size())) != 1)
            throw std::runtime_error("Le moteur n'a pas accepte le texte.");
        start=GetTickCount64(); bool done=false;
        while (GetTickCount64()-start<80000 && !sink->failed) {
            Sleep(10);
            if (sink->idle && sink->bytes>0 && !(status(object,0)&4)) { done=true; break; }
        }
        if (sink->failed || !done) throw std::runtime_error("La synthese ELAN n'a pas abouti ou a depasse son delai.");
        symbol<Get>(module,"?wpsolaClose@CWpsolaThread@@QAEHK@Z")(object,0);
        // Wait for the native synthesis thread before finalizing its output.
        symbol<Dispose>(module,"??1CWpsolaThread@@QAE@XZ")(object);
        header(sink->file,hz,sink->bytes);
        if (ferror(sink->file) || fflush(sink->file)) throw std::runtime_error("Echec d'ecriture du fichier WAV.");
        fclose(sink->file); sink->file=nullptr;
        return 0;
    } catch (const std::exception& ex) {
        if (error && errorCapacity>0) strncpy_s(error,errorCapacity,ex.what(),_TRUNCATE);
        // The caller exits this isolated process immediately after writing its result.
        return 1;
    }
}
