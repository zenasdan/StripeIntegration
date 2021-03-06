﻿(function () {
    'use strict';

    angular.module(AppName).directive("stripeForm", ['requestService', '$window', function (requestService, $window) {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                amountInPennies: "=",
                confirmModel: "="
            },
            templateUrl: '/scripts/components/views/stripeForm.html',
            link: function link(scope, element, attrs) {
                //GET THE STRIPE PUBLISHABLE KEY
                requestService.ApiRequestService("GET", "/api/payments/StripePublishableKey", null)
                    .then(function (response) {
                        //CREATE A STRIPE OBJECT USING THE STRIPE SCRIPT ON THE CSHTML PAGE
                        var stripe = $window.Stripe(response.item);
                        //CREATE STRIPE ELEMENTS
                        var elements = stripe.elements();
                        //ADD SOME STYLE TO YOUR CARD ELEMENT
                        var style = {
                            base: {
                                color: '#32325d',
                                lineHeight: '18px',
                                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                                fontSmoothing: 'antialiased',
                                fontSize: '16px',
                                '::placeholder': {
                                    color: '#aab7c4'
                                }
                            },
                            invalid: {
                                color: '#fa755a',
                                iconColor: '#fa755a'
                            }
                        };
                        //CREATE A CARD ELEMENT
                        var card = elements.create('card', { style: style });
                        //MOUNT YOUR CARD ELEMENT TO THE CARD FIELD ON THE DOM
                        card.mount('#cardNumber');

                        //VALIDATION - ON FIELD CHANGE, VALIDATE CONTINUOUSLY. VALIDATION COMES FROM STRIPE, NOT FROM OUR CODE
                        card.addEventListener('change', function (event) {
                            //CARD ERRORS DIV ON THE DOM, WHICH WILL SHOW ANY ERRORS
                            var displayError = document.getElementById('card-errors');
                            if (event.error) {
                                displayError.textContent = event.error.message;
                            } else {
                                displayError.textContent = '';
                            }
                        });

                        //LISTEN FOR A SUBMIT - WILL SEND THE CARD DATA TO STRIPE, THEN STRIPE WILL RETURN
                        //A TOKEN THAT REPRESENTS THE CARD. CANNOT HAVE CARD INFORMATION TOUCH OUR SERVERS
                        //DUE TO COMPLIANCE ISSUES THAT WE DON'T WANT TO DEAL WITH. STRIPE WILL HANDLE ALL THOSE
                        //ISSUES SINCE THE CARD INFO TOUCHES THEIR SERVERS. THIS IS WHY WE RECEIVE A TOKEN INSTEAD
                        //OF USING STRAIGHT CARD INFORMATION. YOU WILL THEN USE THAT CARD REPRESENTATION TOKEN
                        //TO CREATE A CHARGE TO STRIPE IN THE NEXT FUNCTION.
                        var form = document.getElementById('paymentForm');
                        form.addEventListener('submit', function (event) {
                            event.preventDefault();
                            //DISPLAY ERROR MESSAGE IF SOMETHING WENT WRONG WITH TOKEN RETRIEVAL
                            stripe.createToken(card).then(function (result) {
                                if (result.error) {
                                    var errorElement = document.getElementById('card-errors');
                                    errorElement.textContent = result.error.message;
                                } else {
                                    stripeTokenHandler(result.token);
                                }
                            });
                        });

                        //ON SUBMIT... IF TOKEN IS SUCCESSFULLY RETRIEVED FROM STRIPE, DO A POST TO OUR SERVER. WILL
                        //USE API CALLS TO CHARGE THE USER'S CARD WITH THE EQUIVALENT TOKEN REPRESENTATION. NOTE: MUST
                        //INPUT CHARGE AMOUNT IN CENTS!!!!
                        function stripeTokenHandler(token) {

                            token.amountInPennies = scope.amountInPennies * 100;
                            if (scope.confirmModel.customerId === null) {
                                token.email = scope.confirmModel.email;
                            } else {
                                token.customer = scope.confirmModel.customerId;
                            }

                            requestService.ApiRequestService("POST", "/Member/Subscription/Charge", token)
                                .then(function (response) {
                                    //CLEAR CARD INFORMATION UPON SUCCESS
                                    card.clear();
                                    //NOT NECESSARY BUT IM UNMOUNTING CARD SO USER CANNOT ENTER IN INFORMATION AGAIN
                                    card.unmount('#cardNumber');
                                    //SWEET ALERT ON SUCCESS AND THEN REDIRECT TO MEMBER INDEX PAGE
                                    swal({
                                        title: "Congratulations!",
                                        text: "Your payment was successfully received and you are now a subscriber to LeaseHold!",
                                        type: "success",
                                        showCancelButton: false,
                                        confirmButtonClass: "btn-success",
                                        confirmButtonText: "Okay",
                                        closeOnConfirm: true
                                    },
                                        function () {
                                            //ASSIGNING CONFIRMMODEL OBJECT TO FIT
                                            var choiceModel = {};
                                            choiceModel.subscriptionTierId = scope.confirmModel.id;
                                            choiceModel.priceCharged = scope.confirmModel.subscriptionLease;
                                            choiceModel.pricePerMonth = scope.confirmModel.pricePerMonth;
                                            choiceModel.annualDiscount = scope.confirmModel.annualDiscount;
                                            choiceModel.customerToken = response.CustomerId;
                                            choiceModel.transactionToken = response.BalanceTransactionId;

                                            requestService.ApiRequestService('post', '\/api/SubscriptionTiers/Subscribe', choiceModel)
                                            .then(function (res) {
                                                location.href = "/Member/Index";
                                            })
                                            .catch(function (err) {
                                            })
                                        });
                                })
                                .catch(function (err) {
                                    swal("Oops!", "Unfortunately, we were unable to process your payment request at this time. Please try again later.", "error");
                                });
                        }
                    })
                    .catch(function (err) {
                    });
            }
        }
    }]);
})();