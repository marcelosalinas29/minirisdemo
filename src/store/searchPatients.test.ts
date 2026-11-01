import { describe, it, expect } from 'vitest';
import { useClinicStore } from './useClinicStore';
const mk=(id:string,name:string,dni:string,phone='+5493482111111')=>({id,name,dni,age:30,phone,obraSocial:''} as any);
describe('searchPatients',()=>{
  useClinicStore.setState({patients:[mk('1','Pérez Juan','12.345.678'),mk('2','Juan Pereyra','23456789'),mk('3','Gómez María','12345999','+5493482999888')]});
  const s=(q:string)=>useClinicStore.getState().searchPatients(q).map(p=>p.id);
  it('dni con puntos',()=>expect(s('12.345.678')).toEqual(['1']));
  it('dni parcial',()=>expect(s('12345')).toEqual(['3','1']));
  it('sin tilde',()=>expect(s('perez')).toEqual(['1']));
  it('orden invertido',()=>expect(s('juan perez')).toEqual(['1']));
  it('apellido primero',()=>expect(s('pere')).toEqual(['1','2']));
  it('telefono',()=>expect(s('999888')).toEqual(['3']));
});

describe('findPatientByDni',()=>{
  it('encuentra DNI cargado con puntos al escribirlo sin puntos',async()=>{
    useClinicStore.setState({patients:[mk('1','Pérez Juan','12.345.678')]});
    const p=await useClinicStore.getState().findPatientByDni('12345678');
    expect(p?.id).toBe('1');
  });
});
