class Stack :
    def __init__(self):
        self.items = []
    def is_empty(self):
        return self.items == []
    def push(self, item):
        self.items.insert(0, item)
    def pop(self):
        return self.items.pop(0)
    def peek(self):
        return self.items[0]
    def size(self):
        return len(self.items)
    def popindeks(self,indeks):
        return self.items.pop(indeks)
    def find(self,data):
        for i in range(len(self.items)) :
            if self.items[i]==data :
                return i
        return None
    def masukan(self,indeks,item):
        self.items.insert(indeks, item)
    def jumlah(self):
        return len(self.items)
                
    
s = Stack()
h = Stack()
p = Stack()

def aska(a):
    if a > 0 :
        if a == 1:
            h.push(a)
            teks = '1'
            p.push(teks)
        else :
            s.push(a)
            h.push(a)
        if a > 1 :
            if a%4 == 3 :
                s.push(':')
                h.push(':')
            elif a%4 == 2 :
                s.push('*')
                h.push('*')
            elif a%4 == 1 :
                s.push('-')
                h.push('-')
            elif a%4 == 0 :
                s.push('+')
                h.push('+')
        return aska((a-1))
    else :
        if not s.is_empty():
            isi = s.pop()
            teks = p.pop()
            teks += str(isi)
            p.push(teks)
            return aska(0)
        elif h.jumlah()>1:
            kali = h.find('*')
            if kali != None :
                h.popindeks(kali)
                kanan = h.popindeks(kali)
                kiri = h.popindeks(kali-1)
                hasil = kiri*kanan
                h.masukan(kali-1, hasil)
                return aska(0)
            bagi = h.find(':')
            if bagi != None :
                h.popindeks(bagi)
                kanan = h.popindeks(bagi)
                kiri = h.popindeks(bagi-1)
                hasil = kiri/kanan
                h.masukan(bagi-1, hasil)
                return aska(0)
            minus = h.find('-')
            if minus != None :
                h.popindeks(minus)
                kanan = h.popindeks(minus)
                kiri = h.popindeks(minus-1)
                hasil = kiri-kanan
                h.masukan(minus-1, hasil)
                return aska(0)
            tambah = h.find('+')
            if tambah != None :
                h.popindeks(tambah)
                kanan = h.popindeks(tambah)
                kiri = h.popindeks(tambah-1)
                hasil = kiri+kanan
                h.masukan(tambah-1, hasil)
                return aska(0)
            
        hasil = p.pop() + '=' + str(h.pop())
        return hasil
            
a = int(input("masukkan angka :"))    
print (aska(a))
