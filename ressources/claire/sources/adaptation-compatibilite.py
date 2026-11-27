"""Development helper: python adaptation-compatibilite.py original.dll adapted.dll
Requires pefile, for rebuilding only. Never replace a system file.
The web page needs no Python dependency.
"""
import argparse
import pefile
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('source',type=Path)
parser.add_argument('destination',type=Path)
args=parser.parse_args()
if args.source.resolve()==args.destination.resolve():
    parser.error('The output must be a separate copy.')
p=pefile.PE(str(args.source))
data=bytearray(args.source.read_bytes())
count=0
for entry in p.DIRECTORY_ENTRY_IMPORT:
    if entry.dll.lower().startswith(b'api-ms-'):
        offset=p.get_offset_from_rva(entry.struct.Name)
        data[offset:offset+len(entry.dll)+1]=b'KERNEL32.dll'.ljust(len(entry.dll)+1,b'\x00')
        count+=1
args.destination.write_bytes(data)
print('Windows API aliases redirected to their Wine implementation:',count)
