#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <filesystem>
#include <fstream>
#include <string>
#include <stdexcept>
namespace fs = std::filesystem;
extern "C" int __cdecl RenderElanV2(const wchar_t*,const wchar_t*,const wchar_t*,const wchar_t*,const wchar_t*,int,int,int,int,char*,int);
static std::wstring decode(const std::string& text) {
    int n=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,text.data(),(int)text.size(),nullptr,0);
    if(!n)throw std::runtime_error("Texte UTF-8 invalide.");
    std::wstring result(n,0);MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,text.data(),(int)text.size(),&result[0],n);return result;
}
int wmain(int argc,wchar_t** argv) {
    SetErrorMode(SEM_FAILCRITICALERRORS|SEM_NOGPFAULTERRORBOX);
    if(argc!=4)return 2;
    try {
        wchar_t executable[32768];GetModuleFileNameW(nullptr,executable,32768);fs::path root=fs::path(executable).parent_path();
        std::ifstream input(argv[1],std::ios::binary);if(!input)throw std::runtime_error("Texte absent.");
        std::string bytes(std::istreambuf_iterator<char>(input),{});auto text=decode(bytes);
        if(text.empty()||text.size()>5000)throw std::runtime_error("Limite : 5 000 caracteres.");
        for(auto c:text)if(c==L'\\'||(c<32&&c!=L'\r'&&c!=L'\n'&&c!=L'\t'))throw std::runtime_error("Commandes ELAN interdites.");
        fs::path runtime=root/L"runtime";
        SetDllDirectoryW(runtime.c_str());
        for(const auto* name:{L"scmsgfile.dll",L"BabTts.dll",L"libvoyellise.dll",L"mtsyc32.dll"})
            if(!LoadLibraryW((runtime/name).c_str()))throw std::runtime_error("Chargement d'une dependance ELAN impossible.");
        char error[1024]={};
        int rc=RenderElanV2(runtime.c_str(),(root/L"voix"/L"claire22s.dat").c_str(),L"CLAIRE22S",text.c_str(),argv[2],1252,90,90,100,error,sizeof(error));
        if(rc)throw std::runtime_error(error[0]?error:"Synthese ELAN impossible.");
        ExitProcess(0);
    }catch(const std::exception& ex){std::ofstream error(argv[3],std::ios::binary);error<<ex.what();error.close();ExitProcess(1);}
}
