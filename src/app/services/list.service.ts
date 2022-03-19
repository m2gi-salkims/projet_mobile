import {Injectable} from '@angular/core';
import {List} from "../models/list";
import {Todo} from "../models/todo";
import {AngularFirestore} from "@angular/fire/compat/firestore";
import {AngularFireAuth} from "@angular/fire/compat/auth";
import {combineLatest, Observable} from "rxjs";
import {deleteDoc, doc, setDoc} from "@angular/fire/firestore";
import {AuthenticationService} from './authentication.service';
import {map, switchMap} from "rxjs/operators";

@Injectable({
    providedIn: 'root'
})
export class ListService {

    constructor(public afs: AngularFirestore,
                public auth: AngularFireAuth,
                private authentication: AuthenticationService) {
    }

    public getAll(): Observable<[List[], List[]]> {
        return this.authentication.getUserId().pipe(
          switchMap( user => {
              const obs1 = this.afs.collection<List>('lists/', ref => ref.where('owner','==',user.uid)).valueChanges();
              const obs2 = this.afs.collection<List>('lists/', ref => ref.where('canWrite', 'array-contains', user.uid)).valueChanges();
              const obs2bis = this.afs.collection<List>('lists/', ref => ref.where('canWrite', 'array-contains', user.email)).valueChanges();
              const obs3 = this.afs.collection<List>('lists/', ref => ref.where('canRead', 'array-contains', user.uid)).valueChanges();
              const obs3bis = this.afs.collection<List>('lists/', ref => ref.where('canRead', 'array-contains', user.email)).valueChanges();
              const write = combineLatest([obs1, obs2, obs2bis]).pipe(map(([a, b, bBis]) => a.concat(b.concat(bBis))));
              const read = combineLatest([obs3, obs3bis]).pipe(map(([b, bBis]) => b.concat(bBis)));
              return combineLatest([write,read]);
          })
        )
    }

    public getOne(listId: number): Observable<List> {
        return this.afs.doc<List>('lists/' + listId).valueChanges().pipe(
            switchMap(list => this.afs.collection<Todo>('lists/' + listId + '/todos').valueChanges().pipe(
                map(todos => ({
                    ...list,
                    todos
                    })
                )
            ))
        )
    }

    public getOneTodo(listId: number, todoId: number): Observable<Todo> {
        return this.afs.doc<Todo>('lists/' + listId + '/todos/' + todoId).valueChanges();
    }

    public create(list: List) {
        setDoc(doc(this.afs.firestore, 'lists', list.id.toString()), {
            id: list.id,
            name: list.name,
            owner: list.owner,
            canRead: list.canRead,
            canWrite: list.canWrite
        }).catch(error => console.log("Erreur lors de la création d'un document List ! "+error))
    }

    public createTodo(todo: Todo, listId: number) {
        const todoRef = this.afs.firestore.doc('lists/'+listId.toString());
        setDoc(doc(todoRef, 'todos', todo.id.toString()), {
            id: todo.id,
            name: todo.name,
            isDone: todo.isDone,
            description: todo.description,
            estimate: todo.estimate,
            create: todo.create,
            start: null,
            end: todo.end
        }).catch(error => console.log("Erreur lors de la création d'un document Todo ! "+error));
    }

    public updateTodo(todo: any, todoId: number, listId: number) {
        console.log("update");
        this.afs.firestore.doc('lists/' + listId.toString() + '/todos/' + todoId.toString()).update({
            name: todo.name,
            isDone: todo.isDone ? todo.isDone : false,
            description: todo.description,
        }).catch( e => console.log(e))
    }

    public  delete(listId: number) {
        deleteDoc(doc(this.afs.firestore, "lists", listId.toString())).catch(error => console.log("Erreur lors de la suppression d'un document List ! "+error));
    }

    public deleteTodo(listId: number, todoId: number) {
        const todoRef = this.afs.firestore.doc('lists/'+listId.toString())
        deleteDoc(doc(todoRef, "todos", todoId.toString())).catch(error => console.log("Erreur lors de la suppression d'un document Todo ! "+error));
    }
}
