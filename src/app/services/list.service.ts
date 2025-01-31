import {Injectable} from '@angular/core';
import {List} from "../models/list";
import {Todo} from "../models/todo";
import {AngularFirestore} from "@angular/fire/compat/firestore";
import {combineLatest, Observable} from "rxjs";
import {deleteDoc, doc, setDoc} from "@angular/fire/firestore";
import {AuthenticationService} from './authentication.service';
import {map, switchMap} from "rxjs/operators";
import {formatDate} from "@angular/common";
import {Token} from "../models/token";
import {User} from '../models/user';
import {Notifications} from '../models/notifications';

@Injectable({
  providedIn: 'root'
})
export class ListService {

  constructor(public afs: AngularFirestore,
              private authentication: AuthenticationService) {
  }

  public getAll()  {
    return this.authentication.getUser().pipe(
      switchMap( user => {
        const owner = this.afs.collection<List>('lists/', ref => ref.where('owner','==',user.uid)).valueChanges();
        // const obs2 = this.afs.collection<List>('lists/', ref => ref.where('canWrite', 'array-contains', user.uid)).valueChanges();
        const write = this.afs.collection<List>('lists/', ref => ref.where('canWrite', 'array-contains', user.email)).valueChanges();
        // const obs3 = this.afs.collection<List>('lists/', ref => ref.where('canRead', 'array-contains', user.uid)).valueChanges();
        const read = this.afs.collection<List>('lists/', ref => ref.where('canRead', 'array-contains', user.email)).valueChanges();
        const rw = combineLatest([write, read]);
        return combineLatest([combineLatest([owner]),rw]);
      })
    )
  }

  public getAllSorted()  {
    return this.authentication.getUser().pipe(
        switchMap( user => {
          const owner = this.afs.collection<List>('lists/', ref => ref.where('owner','==',user.uid).orderBy("name")).valueChanges();
          // const obs2 = this.afs.collection<List>('lists/', ref => ref.where('canWrite', 'array-contains', user.uid)).valueChanges();
          const write = this.afs.collection<List>('lists/', ref => ref.where('canWrite', 'array-contains', user.email).orderBy("name")).valueChanges();
          // const obs3 = this.afs.collection<List>('lists/', ref => ref.where('canRead', 'array-contains', user.uid)).valueChanges();
          const read = this.afs.collection<List>('lists/', ref => ref.where('canRead', 'array-contains', user.email).orderBy("name")).valueChanges();
          const rw = combineLatest([write, read]);
          return combineLatest([combineLatest([owner]),rw]);
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

  public getOneUser(userUid: string): Observable<User> {
    return this.afs.doc<User>('users/' + userUid).valueChanges();
  }

  public canWrite(listId: number) : Observable<boolean> {
    return this.authentication.getUser().pipe(
        switchMap( user => {
          return this.getOne(listId).pipe(map( list => {
            return list.canWrite.includes(user.email) || user.uid == list.owner;
          }));
        })
    )
  }

  public getOneTodo(listId: number, todoId: number): Observable<Todo> {
    return this.afs.doc<Todo>('lists/' + listId + '/todos/' + todoId).valueChanges();
  }

  public getToken(token: string): Observable<Token> {
    return this.afs.doc<Token>('QRToken/' + token ).valueChanges();
  }

  public create(list: List) {
    setDoc(doc(this.afs.firestore, 'lists', list.id.toString()), {
      id: list.id,
      name: list.name,
      owner: list.owner,
      canRead: list.canRead,
      canWrite: list.canWrite
    }).catch(error => this.authentication.presentAlert("Erreur de création","Erreur lors de la création d'un document List ! "))
      .then(() => {
        this.authentication.presentAlert("Création réussi !","La liste <b>"+list.name+"</b> a été ajoutée.");
        list.canWrite.forEach(userMail => this.addNotification(new Notifications("Vous avez été ajouté à la liste "+list.name+" avec les droits de lecture et d'écriture.", userMail)));
        list.canRead.forEach(userMail => this.addNotification(new Notifications("Vous avez été ajouté à la liste "+list.name+" avec les droits de lecture.",userMail)));
      });
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
      start: "",
      end: ""
    }).catch(error => this.authentication.presentAlert("Erreur de création","Erreur lors de la création d'un document Todo ! "))
        .then(() => this.authentication.presentAlert("Création réussi","La tâche <b>"+todo.name+"</b> a été ajoutée."));
  }

  public createQRToken(myId: string, listId: number ) {
    setDoc(doc(this.afs.firestore, 'QRToken', myId), {
      canWrite: false,
      created: formatDate(new Date(), 'yyyy-MM-ddTHH:mm:ss', 'en'),
      listId: listId,
    })
      .catch(error => this.authentication.presentAlert("Erreur de création","Erreur lors de la création du token ! "))
  }


  public updateTodo(todo: any, todoId: number, listId: number) {
    this.afs.firestore.doc('lists/' + listId.toString() + '/todos/' + todoId.toString()).update({
      name: todo.name ? todo.name : "",
      isDone: todo.isDone ? todo.isDone : false,
      description: todo.description ? todo.description : "",
      start: todo.start ? todo.start : "",
      end: todo.end ? todo.end : ""
    }).catch( e => console.log(e))
  }

  public updateList(listId: number, canRead: string[], canWrite: string[], listName: string, newUserMail: string) {
    this.afs.firestore.doc('lists/' + listId.toString()).update({
      canRead: canRead,
      canWrite: canWrite
    }).catch( e => console.log(e))
      .then( () => {
        if (canWrite.includes(newUserMail)) {
          this.addNotification(new Notifications("Vous avez été ajouté à la liste "+listName+" avec les droits de lecture et d'écriture.", newUserMail));
        } else {
          this.addNotification(new Notifications("Vous avez été ajouté à la liste "+listName+" avec les droits de lecture.", newUserMail));
        }
      })
  }

  public updateQRToken(token: string, writeRight: boolean) {
    this.afs.firestore.doc('QRToken/' + token).update({
      canWrite: writeRight,
    }).catch( e => console.log(e))
  }

  public delete(listId: number) {
    deleteDoc(doc(this.afs.firestore, "lists", listId.toString())).catch(error => this.authentication.presentAlert("Erreur de suppression","Erreur lors de la suppression d'un document List ! "));
  }

  public deleteTodo(listId: number, todoId: number) {
    const todoRef = this.afs.firestore.doc('lists/'+listId.toString())
    deleteDoc(doc(todoRef, "todos", todoId.toString())).catch(error => this.authentication.presentAlert("Erreur de suppression","Erreur lors de la suppression d'un document Todo ! "));
  }

  public deleteQRCode(token: string) {
    deleteDoc(doc(this.afs.firestore, "QRToken", token)).catch(error => this.authentication.presentAlert("Erreur de suppression","Erreur lors de la suppression d'un document QRToken ! "));
  }

  private addNotification(notif: Notifications) {
    setDoc(doc(this.afs.firestore, 'notifications/', notif.id.toString()), {
      id: notif.id,
      userMail: notif.userMail,
      created: notif.created,
      message: notif.message,
      isRead: notif.isRead
    }).catch(error => this.authentication.presentAlert("Erreur de création", "Erreur lors de la création d'un document Notifications ! "+error))
  }

  public getNotifications(userMail: string) : Observable<Notifications[]> {
    return this.afs.collection<Notifications>('notifications/', ref => ref.where('userMail', '==', userMail)).valueChanges();
  }

  public deleteNotifications(notifId: number) {
    deleteDoc(doc(this.afs.firestore, "notifications", notifId.toString())).catch(error => this.authentication.presentAlert("Erreur de suppression","Erreur lors de la suppression d'un document Notifications ! "));
  }

  public notificationRead(notifId: number) {
    this.afs.firestore.doc('notifications/' + notifId.toString()).update({
      isRead: true
    }).catch( e => console.log(e))
  }
}
