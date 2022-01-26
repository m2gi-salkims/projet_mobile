import { Component, OnInit } from '@angular/core';
import {Todo} from "../../models/todo";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {ListService} from "../../services/list.service";
import {List} from "../../models/list";
import {ModalController, NavParams} from "@ionic/angular";

@Component({
  selector: 'app-create-list',
  templateUrl: './create-list.component.html',
  styleUrls: ['./create-list.component.scss'],
})
export class CreateListComponent implements OnInit {
  public ionicForm : FormGroup;

  constructor(public formBuilder: FormBuilder, public listService : ListService, public modalController: ModalController) { }

  ngOnInit() {
    this.ionicForm = new FormGroup({
      name: new FormControl()
    });
  }

  async closeModal() {
    await this.modalController.dismiss();
  }

  addList() {
    if(this.ionicForm.value.name != null) {
      this.listService.create(new List(this.ionicForm.value.name, []))
      this.closeModal();
    }
  }
}
