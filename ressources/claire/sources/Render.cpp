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
static std::string read(const fs::path& path) {
    std::ifstream input(path,std::ios::binary);
    return input ? std::string(std::istreambuf_iterator<char>(input),{}) : std::string();
}
static void write(const fs::path& path,const std::string& value) {
    std::ofstream out(path,std::ios::binary|std::ios::trunc);out<<value;out.close();
}
static void synthesize(const fs::path& root,const std::wstring& text,const fs::path& output) {
    if(text.size()>5000)throw std::runtime_error("Limite : 5 000 caracteres.");
    for(auto c:text)if(c==L'\\'||(c<32&&c!=L'\r'&&c!=L'\n'&&c!=L'\t'))throw std::runtime_error("Commandes ELAN interdites.");
    char error[1024]={};
    int rc=RenderElanV2((root/L"runtime").c_str(),(root/L"voix"/L"claire22s.dat").c_str(),L"CLAIRE22S",text.c_str(),output.c_str(),1252,90,90,100,error,sizeof(error));
    if(rc)throw std::runtime_error(error[0]?error:"Synthese ELAN impossible.");
}
int wmain(int argc,wchar_t** argv) {
    SetErrorMode(SEM_FAILCRITICALERRORS|SEM_NOGPFAULTERRORBOX);
    bool serve=argc==2&&std::wstring(argv[1])==L"--serve";
    if(!serve&&argc!=4)return 2;
    wchar_t executable[32768];GetModuleFileNameW(nullptr,executable,32768);fs::path root=fs::path(executable).parent_path();
    try {
        fs::path runtime=root/L"runtime";
        SetDllDirectoryW(runtime.c_str());
        for(const auto* name:{L"scmsgfile.dll",L"BabTts.dll",L"libvoyellise.dll",L"mtsyc32.dll"})
            if(!LoadLibraryW((runtime/name).c_str()))throw std::runtime_error("Chargement d'une dependance ELAN impossible.");
        if(serve){
            synthesize(root,L"",root/L"audio.wav");
            write(root/L"engine.ready","ready");
            std::string previous;
            while(true){
                std::string id=read(root/L"request.id");
                if(id.empty()||id==previous){Sleep(50);continue;}
                previous=id;
                DeleteFileW((root/L"error.txt").c_str());
                DeleteFileW((root/L"audio.wav").c_str());
                try{synthesize(root,decode(read(root/L"text.txt")),root/L"audio.wav");}
                catch(const std::exception& ex){write(root/L"error.txt",ex.what());write(root/L"result.id",id);ExitProcess(1);}
                write(root/L"result.id",id);
            }
        }
        synthesize(root,decode(read(argv[1])),argv[2]);
        ExitProcess(0);
    }catch(const std::exception& ex){write(serve?root/L"boot-error.txt":fs::path(argv[3]),ex.what());ExitProcess(1);}
}
